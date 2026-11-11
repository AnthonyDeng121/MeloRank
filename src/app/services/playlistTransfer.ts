import { netease, type LibraryItem } from './musicPlatforms';
import { QQ_MUSIC_CONFIG } from './qqMusicConfig';
import { searchPlatform, platformAlbumTracks, type PlatformSong } from './platformSongs';
import type { RankingItem } from '../contexts/RankingContext';

export type WritableProvider = 'qq' | 'netease';
export interface TransferMatch { entry: RankingItem; song?: PlatformSong; error?: string; rule: 'song' | 'album-first' }
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

export async function matchRankingEntry(provider: WritableProvider, entry: RankingItem, albums: boolean): Promise<TransferMatch> {
  const rule = albums ? 'album-first' : 'song';
  try {
    if (!entry.title.trim() || !entry.artist.trim()) throw new Error('作品名或歌手信息不完整');
    if (albums) {
      // Neither mounted platform API exposes reliable per-song collection counts.
      // Preserve the album's platform track order instead of substituting popularity.
      const tracks = await platformAlbumTracks(provider, entry.title, entry.artist, '');
      if (!tracks[0]?.songmid) throw new Error('专辑没有可导入的第一首歌曲');
      return { entry, song: { ...tracks[0], provider }, rule };
    }
    const response = await searchPlatform(provider, `${entry.title} ${entry.artist}`, 30, 1);
    const data = response.response || response;
    const artists = entry.artist.split(/\s+[\/&,]\s+|,\s*/).map(normalize).filter(Boolean);
    const candidates: PlatformSong[] = ((data.data || data).song?.list || []).map((song: any) => ({ ...song, provider, songmid: song.songmid || song.mid, songname: song.songname || song.name, albumname: song.albumname || song.album?.name || '', albummid: song.albummid || song.album?.mid || '' }));
    const song = candidates.find(song => normalize(song.songname || '') === normalize(entry.title) && song.singer?.some(artist => artists.includes(normalize(artist.name))));
    if (!song?.songmid) throw new Error('未匹配到同名歌曲及歌手，请核对名称');
    return { entry, song, rule };
  } catch (reason) { return { entry, error: (reason as Error).message, rule }; }
}

async function qq(path: string, body?: Record<string, unknown>) {
  const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/${path}`, { method: body ? 'POST' : 'GET', credentials: 'omit', headers: { 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(60000) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'QQ 音乐请求失败'); return result;
}
export async function readOwnPlaylists(provider: WritableProvider): Promise<LibraryItem[]> {
  const items: LibraryItem[] = []; let offset = 0;
  while (true) {
    const page = provider === 'qq' ? await qq(`library?kind=playlists&offset=${offset}`) : await netease.request('library', { kind: 'playlists', offset });
    items.push(...page.items); if (!page.hasMore || !page.items.length) return items;
    const next = page.nextOffset ?? offset + page.items.length; if (next <= offset) throw new Error('歌单分页异常'); offset = next;
  }
}
export async function readPlaylistIds(provider: WritableProvider, id: string): Promise<string[]> {
  const ids: string[] = []; let offset = 0;
  while (true) {
    const page = provider === 'qq' ? await qq(`library?kind=collection&type=playlists&id=${encodeURIComponent(id)}&offset=${offset}`) : await netease.request('collection', { kind: 'playlists', id, offset });
    ids.push(...page.items.map((item: LibraryItem) => item.id));
    if (!page.hasMore || !page.items.length) break;
    const next = page.nextOffset ?? offset + page.items.length; if (next <= offset) throw new Error('歌单分页异常'); offset = next;
  }
  if (new Set(ids).size !== ids.length) throw new Error('目标歌单数据不完整，请刷新重试');
  return ids;
}
export const writePlaylist = (provider: WritableProvider, body: Record<string, unknown>) => provider === 'qq' ? qq('playlist/edit', body) : netease.request('playlist/edit', body);

export async function appendRankingTracks(provider: WritableProvider, id: string, songs: PlatformSong[], progress: (done: number, total: number) => void,
  adapters = { read: readPlaylistIds, write: writePlaylist }) {
  const original = await adapters.read(provider, id), desired = [...original], seen = new Set(original);
  const additions: string[] = [];
  for (const song of songs) {
    if (song.provider && song.provider !== provider) throw new Error('歌曲与目标平台不一致，请重新匹配');
    const trackId = provider === 'qq' ? song.songmid : song.providerId;
    if (!trackId) throw new Error('歌曲标识不完整，请重新匹配');
    if (!seen.has(trackId)) { seen.add(trackId); additions.push(trackId); desired.push(trackId); }
  }
  let current = [...original], added = 0;
  try {
    for (const trackId of additions) {
      const result = await adapters.write(provider, { id, action: 'add', trackId, baseIds: current });
      if (!Array.isArray(result.ids) || !result.ids.includes(trackId)) throw new Error('平台未返回完整写入结果');
      current = result.ids; added++; progress(added, additions.length);
    }
    if (JSON.stringify(current) !== JSON.stringify(desired)) await adapters.write(provider, { id, action: 'reorder', ids: desired, baseIds: current });
    const actual = await adapters.read(provider, id);
    if (JSON.stringify(actual) !== JSON.stringify(desired)) throw new Error('最终顺序核对失败，请刷新平台歌单检查');
    return { added, skipped: songs.length - additions.length };
  } catch (reason) {
    throw new Error(`已确认添加 ${added} 首。${(reason as Error).message}；最后一次请求可能已生效，请刷新目标歌单核对后再操作。`);
  }
}

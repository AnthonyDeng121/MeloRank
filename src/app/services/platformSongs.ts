import { netease, spotify, type MusicProvider } from './musicPlatforms';
import { qqMusicService } from './qqMusicService';

export interface PlatformSong {
  songmid: string; songname: string; singer: Array<{ name: string; mid: string }>;
  albumname: string; albummid: string; coverUrl?: string; duration?: number;
  provider?: MusicProvider; providerId?: string; uri?: string; url?: string; albumId?: string;
}
export function neteaseSong(value: any): PlatformSong {
  const album = value.al || value.album || {};
  return { provider: 'netease', providerId: String(value.id), songmid: `netease:${value.id}`, songname: value.name,
    singer: (value.ar || value.artists || []).map((artist: any) => ({ name: artist.name, mid: String(artist.id || '') })),
    albumname: album.name || '', albumId: String(album.id || ''), albummid: '', coverUrl: album.picUrl, duration: (value.dt || value.duration || 0) / 1000 };
}
export function spotifySong(value: any): PlatformSong {
  return { provider: 'spotify', providerId: value.id, uri: value.uri || `spotify:track:${value.id}`, songmid: `spotify:${value.id}`, songname: value.name,
    singer: (value.artists || []).map((artist: any) => ({ name: artist.name, mid: artist.id || '' })), albumname: value.album?.name || '', albummid: '',
    albumId: value.album?.id || '', coverUrl: value.album?.images?.[0]?.url, duration: (value.duration_ms || 0) / 1000 };
}
export const songCover = (song: { coverUrl?: string; albummid?: string }) => (song.coverUrl || (song.albummid ? `https://y.qq.com/music/photo_new/T002R300x300M000${song.albummid}.jpg` : '')).replace(/^http:/, 'https:');
export async function searchPlatform(provider: MusicProvider, query: string, limit: number, page: number) {
  if (provider === 'qq') return qqMusicService.searchWithType(query, limit, 'songs', page);
  let list: PlatformSong[], total: number;
  if (provider === 'netease') {
    const data = await netease.request('search', { query, limit, offset: (page - 1) * limit });
    list = data.songs.map(neteaseSong); total = data.total;
  } else {
    const data = await spotify.request(`/search?${new URLSearchParams({ q: query, type: 'track', limit: String(Math.min(limit, 10)), offset: String((page - 1) * limit) })}`);
    list = (data.tracks?.items || []).map(spotifySong); total = data.tracks?.total || 0;
  }
  return { response: { data: { song: { list, totalnum: total } } } };
}
export async function platformSongUrl(song: PlatformSong): Promise<any> {
  if (!song.provider || song.provider === 'qq') return qqMusicService.getSongUrl(song.songmid);
  if (song.provider === 'spotify') throw new Error('Spotify 歌曲需要使用官方播放器');
  const result = await netease.request('playback', { id: song.providerId });
  return { data: { playUrl: { [song.songmid]: { url: result.url, isPreview: result.isPreview } } } };
}
export async function platformLyric(song: PlatformSong): Promise<any> {
  if (!song.provider || song.provider === 'qq') return qqMusicService.getLyric(song.songmid);
  if (song.provider === 'spotify') return { response: { lyric: '' } };
  const result = await netease.request('lyric', { id: song.providerId });
  return { response: { lyric: result.lyric, trans: result.translation, roma: result.romanization } };
}
export async function platformPlayableUrl(song: PlatformSong) {
  if (!song.provider || song.provider === 'qq') return qqMusicService.getPlayableUrl(song.songmid);
  if (song.provider === 'spotify') throw new Error('Spotify 不提供音频文件下载');
  const result = await netease.request('playback', { id: song.providerId });
  if (result.isPreview) throw new Error('平台仅提供试听片段，不能作为完整歌曲下载');
  return result.url as string;
}

export async function platformAlbumTracks(provider: MusicProvider, title: string, artist: string, cover: string): Promise<PlatformSong[]> {
  if (provider === 'qq') return qqMusicService.getAlbumTracks(title, artist, cover);
  const normalize = (text: string) => text.toLocaleLowerCase().replace(/[\s\p{P}]/gu, '');
  const query = `${title} ${artist}`;
  const albums = provider === 'netease' ? (await netease.request('album-search', { query })).albums : (await spotify.request(`/search?${new URLSearchParams({ q: query, type: 'album', limit: '10' })}`)).albums?.items || [];
  const album = albums.find((value: any) => normalize(value.name) === normalize(title) && (value.artists || []).some((value: any) => normalize(artist).includes(normalize(value.name))));
  if (!album) throw new Error('当前平台未找到匹配的专辑，请尝试搜索歌曲');
  const songs: PlatformSong[] = [];
  let hasMore = true;
  while (hasMore) {
    if (provider === 'netease') {
      const page = await netease.request('collection', { kind: 'albums', id: String(album.id), offset: songs.length });
      songs.push(...page.items.map((item: any) => neteaseSong(item.neteaseTrack)));
      hasMore = !!page.hasMore && page.items.length > 0;
    } else {
      const page = await spotify.request(`/albums/${album.id}/tracks?limit=50&offset=${songs.length}`);
      songs.push(...(page.items || []).map((track: any) => spotifySong({ ...track, album })));
      hasMore = !!page.next && page.items?.length > 0;
    }
  }
  if (!songs.length) throw new Error('当前专辑没有可播放的歌曲');
  return songs;
}

// Only reuse catalog matches, never playback URLs or account credentials.
const playbackMatches = new Map<string, Promise<PlatformSong>>();
// Content-rating labels are presentation metadata, not musical versions.
// Keep Live/Remix/Acoustic etc. so different recordings remain distinct.
export const playbackTitle = (value: string) => value.normalize('NFKC')
  .replace(/(?:\s*[([]\s*(?:explicit|clean|edited)(?:\s+(?:edit|version))?\s*[)\]])+\s*$/gi, '').trim();
export function resolvePlaybackSong(song: PlatformSong, target: MusicProvider): Promise<PlatformSong> {
  if ((song.provider || 'qq') === target) return Promise.resolve(song);
  const key = JSON.stringify([target, song.provider || 'qq', song.songmid, song.songname, song.singer, song.albumname]);
  const cached = playbackMatches.get(key);
  if (cached) return cached;
  const match = (async () => {
    const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
    const title = normalize(playbackTitle(song.songname));
    const artists = song.singer.map(artist => normalize(artist.name)).filter(Boolean);
    if (!title || !artists.length) throw new Error('歌曲名称或歌手信息不足，无法匹配播放来源');
    const result = await searchPlatform(target, `${playbackTitle(song.songname)} ${song.singer.map(artist => artist.name).join(' ')}`, 10, 1);
    const candidates: PlatformSong[] = (result.response?.data?.song?.list || []).map((value: any) => target === 'qq' ? {
      ...value, provider: 'qq', songmid: value.songmid || value.mid, songname: value.songname || value.name,
      albumname: value.albumname || value.album?.name || '', albummid: value.albummid || value.album?.mid || '',
      duration: value.duration || value.interval,
    } : value);
    const exact = candidates.filter(candidate => candidate.songmid && normalize(playbackTitle(candidate.songname)) === title
      && candidate.singer?.some(artist => artists.includes(normalize(artist.name)))
      && (!song.duration || !candidate.duration || Math.abs(song.duration - candidate.duration) <= 5));
    const albumMatches = exact.filter(candidate => song.albumname && normalize(candidate.albumname) === normalize(song.albumname));
    const matches = albumMatches.length ? albumMatches : exact;
    if (!matches.length) throw new Error('当前播放来源未找到同名歌手的对应歌曲，请切换播放来源或手动搜索');
    return matches[0];
  })();
  if (playbackMatches.size >= 200) playbackMatches.delete(playbackMatches.keys().next().value!);
  playbackMatches.set(key, match);
  void match.catch(() => { if (playbackMatches.get(key) === match) playbackMatches.delete(key); });
  return match;
}

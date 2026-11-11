import { netease, spotify, type MusicProvider } from './musicPlatforms';
import { qqMusicService } from './qqMusicService';
import { neteaseSong, spotifySong, songCover, type PlatformSong } from './platformSongs';

export type CatalogKind = 'albums' | 'artists';
export interface CatalogItem { kind: CatalogKind; provider: MusicProvider; id: string; title: string; artist: string; image: string; description?: string; date?: string; total?: number }
export interface CatalogDetail { item: CatalogItem; songs: PlatformSong[]; hasMore: boolean }
const unwrap = (result: any) => { const value = result.body || result; const response = value.response || value; return response.data || response; };
const qqSong = (entry: any, album?: CatalogItem): PlatformSong => {
  const s = entry.songInfo || entry.musicData || entry;
  return { ...s, provider: 'qq', songmid: s.songmid || s.mid, songname: s.songname || s.name || s.title,
    singer: s.singer || [], albummid: s.albummid || s.album?.mid || (album?.kind === 'albums' ? album.id : ''),
    albumname: s.albumname || s.album?.name || (album?.kind === 'albums' ? album.title : ''), duration: s.interval || s.duration };
};
export function catalogItem(provider: MusicProvider, kind: CatalogKind, a: any): CatalogItem {
  const album = kind === 'albums';
  const id = String(provider === 'qq' ? (album ? a.albummid || a.albumMID || a.mid : a.singermid || a.singerMID || a.mid) || '' : a.id || '');
  return { provider, kind, id, title: a.albumname || a.singername || a.name || '',
    artist: a.singername || (a.artists || a.singer || (a.artist ? [a.artist] : [])).map((s: any) => s.name).join(' / '),
    image: provider === 'qq' ? (id ? `https://y.qq.com/music/photo_new/${album ? 'T002' : 'T001'}R300x300M000${id}.jpg` : '') : a.picUrl || a.img1v1Url || a.images?.[0]?.url || '',
    date: a.release_date || a.publicTime || (a.publishTime ? new Date(a.publishTime).toLocaleDateString('zh-CN') : ''),
    total: a.total_tracks || a.size || a.song_count };
}
export function songEntity(song: PlatformSong, kind: CatalogKind): CatalogItem {
  return { provider: song.provider || 'qq', kind, id: kind === 'albums' ? song.albumId || song.albummid : song.singer[0]?.mid || '',
    title: kind === 'albums' ? song.albumname : song.singer[0]?.name || '', artist: song.singer.map(s => s.name).join(' / '),
    image: kind === 'albums' ? songCover(song) : (song.provider || 'qq') === 'qq' && song.singer[0]?.mid ? `https://y.qq.com/music/photo_new/T001R300x300M000${song.singer[0].mid}.jpg` : '' };
}
export async function searchCatalog(provider: MusicProvider, kind: CatalogKind, query: string, limit: number, page: number) {
  if (provider === 'qq') {
    const data = unwrap(await qqMusicService.searchWithType(query, limit, kind, page));
    const group = data[kind === 'albums' ? 'album' : 'singer'] || {};
    return { items: (group.list || []).map((a: any) => catalogItem(provider, kind, a)), total: Number(group.totalnum || group.list?.length || 0) };
  }
  if (provider === 'netease') {
    const data = await netease.request('catalog/search', { kind, query, limit, offset: (page - 1) * limit });
    return { items: data.items.map((a: any) => catalogItem(provider, kind, a)), total: data.total };
  }
  const key = kind === 'albums' ? 'albums' : 'artists';
  const data = await spotify.request(`/search?${new URLSearchParams({ q: query, type: key === 'albums' ? 'album' : 'artist', limit: String(Math.min(limit, 10)), offset: String((page - 1) * limit) })}`);
  return { items: (data[key]?.items || []).filter(Boolean).map((a: any) => catalogItem(provider, kind, a)), total: data[key]?.total || 0 };
}
export async function getCatalogDetail(item: CatalogItem, offset = 0): Promise<CatalogDetail> {
  if (!item.id) throw new Error('当前作品缺少平台标识，请在搜索中选择对应专辑或歌手');
  const album = item.kind === 'albums';
  if (item.provider === 'netease') {
    const data = await netease.request('catalog/detail', { kind: item.kind, id: item.id, offset });
    return { item: { ...item, ...data.metadata }, songs: data.songs.map(neteaseSong), hasMore: data.hasMore };
  }
  if (item.provider === 'spotify') {
    const meta = await spotify.request(`/${item.kind}/${encodeURIComponent(item.id)}`);
    const page = await spotify.request(album ? `/albums/${encodeURIComponent(item.id)}/tracks?limit=50&offset=${offset}` : `/artists/${encodeURIComponent(item.id)}/top-tracks`);
    const songs = (album ? page.items || [] : page.tracks || []).map((s: any) => spotifySong(album ? { ...s, album: meta } : s));
    return { item: { ...item, ...catalogItem('spotify', item.kind, meta), description: album ? (meta.label || '') : (meta.genres || []).join(' / ') }, songs, hasMore: album && !!page.next };
  }
  const data = unwrap(await qqMusicService.catalogRequest(album ? '/getAlbumInfo' : '/getSingerHotsong', album ? { albummid: item.id } : { singermid: item.id, limit: 50, page: offset / 50 + 1 }));
  const info = album ? data : data.singer?.data || data;
  const raw = album ? info.list || info.songlist || info.songs || [] : info.songlist || info.list || [];
  const songs = raw.map((s: any) => qqSong(s, item)).filter((s: PlatformSong) => s.songmid);
  if (!songs.length) throw new Error('平台暂未返回曲目，请稍后重试');
  if (album && Number(info.total_song_num) > songs.length) throw new Error('平台返回的专辑曲目不完整，请稍后重试');
  return { item: { ...item, date: info.aDate || info.publicTime || item.date, description: info.desc || info.singer_info?.desc || '', total: Number(info.total_song_num || info.total || songs.length) }, songs,
    hasMore: !album && songs.length === 50 };
}

import type { RankingItem } from '../contexts/RankingContext';
import type { PlatformSong } from '../services/platformSongs';

export function buildPlaylistRanking(songs: PlatformSong[], kind: 'songs' | 'albums'): RankingItem[] {
  const seen = new Set<string>();
  const items: RankingItem[] = [];
  for (const song of songs) {
    const title = kind === 'albums' ? song.albumname : song.songname;
    if (!title?.trim()) throw new Error(kind === 'albums' ? '部分歌曲缺少专辑信息，无法生成完整专辑榜，请刷新或选择单曲榜' : '部分歌曲缺少名称，请刷新歌单');
    const artist = song.singer.map(value => value.name).join(' / ');
    const key = kind === 'albums'
      ? `${song.provider}:${song.albumId || song.albummid || `${title}:${artist}`}`
      : `${song.provider}:${song.providerId || song.songmid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ id: crypto.randomUUID(), rank: items.length + 1, title, artist,
      coverUrl: song.coverUrl || (song.albummid ? `https://y.qq.com/music/photo_new/T002R300x300M000${song.albummid}.jpg` : ''),
      review: '', originalScore: 0, integrity: 0, durability: 0, finalScore: 0 });
  }
  return items;
}

export function reorderPlaylist<T extends { id: string }>(items: T[], from: string, to: string): T[] {
  const start = items.findIndex(item => item.id === from), end = items.findIndex(item => item.id === to);
  if (start < 0 || end < 0 || start === end) return items;
  const result = [...items]; const [moved] = result.splice(start, 1); result.splice(end, 0, moved); return result;
}

import type { PlatformSong } from './platformSongs';

export async function externalLyrics(song: PlatformSong) {
  const backend = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
  const response = await fetch(`${backend}/api/music/lyrics/external`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: song.songname, artists: song.singer.map(artist => artist.name), duration: song.duration || (song as PlatformSong & { interval?: number }).interval }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('External lyrics source unavailable');
  return response.json();
}

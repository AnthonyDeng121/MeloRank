const express = require('express');

const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
// Featured artist credits may move between title and artist fields across catalogs.
const trackTitle = value => String(value || '').replace(/\s*[([]\s*(?:feat\.?|ft\.?)\s+.*?[)\]]/gi, '').trim();
function createExternalLyricsRouter(fetchLyrics = fetch) {
  const router = express.Router();
  const cache = new Map();
  router.post('/', async (req, res) => {
    const { title, artists, duration } = req.body;
    if (typeof title !== 'string' || !title.trim() || title.length > 200 || !Array.isArray(artists) || !artists.length || artists.length > 20 || artists.some(a => typeof a !== 'string' || !a.trim() || a.length > 200) || !Number.isFinite(duration) || duration <= 0 || duration > 3600) return res.status(400).json({ error: 'Invalid track metadata' });
    const key = JSON.stringify([title, artists, duration]);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return res.json(cached.result);
    try {
      const query = new URLSearchParams({ track_name: trackTitle(title), artist_name: artists[0] });
      const response = await fetchLyrics(`https://lrclib.net/api/search?${query}`, { headers: { 'User-Agent': 'MeloRank/1.0 (lyrics fallback)', Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Lyrics source unavailable');
      const records = await response.json();
      if (!Array.isArray(records)) throw new Error('Invalid lyrics response');
      const matches = records.filter(record => !record.instrumental && normalize(trackTitle(record.trackName)) === normalize(trackTitle(title))
        && String(record.artistName || '').split(/[,/&;]| feat\.? | ft\.? /i).some(artist => artists.some(value => normalize(value) === normalize(artist)))
        && Number.isFinite(record.duration) && Math.abs(record.duration - duration) <= 3
        && (typeof record.syncedLyrics === 'string' && record.syncedLyrics.trim() || typeof record.plainLyrics === 'string' && record.plainLyrics.trim()))
        .sort((a, b) => Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics) || Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
      const match = matches[0];
      const result = match ? { lyric: (match.syncedLyrics || match.plainLyrics).slice(0, 100000), trans: '', roma: '', source: 'LRCLIB', sourceUrl: `https://lrclib.net/api/get/${match.id}` } : { lyric: '', trans: '', roma: '' };
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { result, expires: Date.now() + (match ? 3600000 : 300000) });
      res.json(result);
    } catch { res.status(502).json({ error: 'External lyrics source unavailable' }); }
  });
  return router;
}
module.exports = { createExternalLyricsRouter };

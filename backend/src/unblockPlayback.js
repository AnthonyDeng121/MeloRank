const { kuwoCarPlayback } = require('./kuwoCarPlayback');
const { verifyAlternative } = require('./verifyAlternative');
const express = require('express');
const router = express.Router();
router.post('/', async (req, res) => {
  const { title, artists, album, duration } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 300 || !Array.isArray(artists) || !artists.length || artists.length > 20 || artists.some(name => typeof name !== 'string' || name.length > 150)) return res.status(400).json({ error: '歌曲名称或歌手信息无效' });
  let timer;
  try {
    const match = require('@unblockneteasemusic/server');
    const data = { id: 0, name: title, artists: artists.map(name => ({ name })), album: { name: typeof album === 'string' ? album.slice(0, 300) : '' }, duration: Math.max(0, Number(duration) || 0) * 1000 };
    const select = async () => {
      let sources = ['kugou', 'bodian'];
      let lastError;
      while (sources.length) {
        let candidate;
        try { candidate = await match(0, sources, data); } catch (error) { lastError = error; break; }
        try { const verifiedDuration = await verifyAlternative(candidate.url, duration); return { ...candidate, verifiedDuration }; }
        catch (error) { lastError = error; }
        sources = sources.filter(source => source !== candidate.source);
      }
      throw lastError || new Error('未找到可验证的完整替代音源');
    };
    let result;
    try {
      result = await Promise.race([select(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Original sources timed out')), 18000); })]);
    } catch {
      clearTimeout(timer);
      result = await kuwoCarPlayback({ title, artists, album, duration }, AbortSignal.timeout(20000));
    }
    if (!result.url || !/^https?:\/\//.test(result.url)) throw new Error('没有找到可用的替代音源');
    res.set('Cache-Control', 'no-store');
    res.json({ url: result.url, source: result.source, bitrate: result.br, verifiedDuration: result.verifiedDuration, isAlternative: true });
  } catch (error) { res.status(502).json({ error: error.message || '没有找到可用的替代音源' }); }
  finally { clearTimeout(timer); }
});
module.exports = router;

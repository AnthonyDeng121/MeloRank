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
      let sources = ['kugou', 'bodian', 'kuwo'];
      while (sources.length) {
        const candidate = await match(0, sources, data);
        const estimate = candidate.br > 1000 && candidate.br < 1000000 && candidate.size ? candidate.size * 8 / candidate.br : null;
        if (!duration || !estimate || estimate >= Number(duration) * 0.75) return candidate;
        sources = sources.filter(source => source !== candidate.source);
      }
      throw new Error('替代音源仅有短片段，未找到完整音源');
    };
    const result = await Promise.race([select(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('换源匹配超时')), 25000); })]);
    if (!result.url || !/^https?:\/\//.test(result.url)) throw new Error('没有找到可用的替代音源');
    res.set('Cache-Control', 'no-store');
    res.json({ url: result.url, source: result.source, bitrate: result.br, isAlternative: true });
  } catch (error) { res.status(502).json({ error: error.message || '没有找到可用的替代音源' }); }
  finally { clearTimeout(timer); }
});
module.exports = router;

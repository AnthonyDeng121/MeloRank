const express = require('express');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const router = express.Router();
const entries = new Map();
function registerAudio(url) {
  const now = Date.now();
  for (const [key, value] of entries) if (value.expires <= now) entries.delete(key);
  if (entries.size >= 200) entries.delete(entries.keys().next().value);
  const token = randomUUID();
  entries.set(token, { url, expires: now + 10 * 60 * 1000 });
  return `/api/music/alternative-audio/${token}`;
}
router.get('/:token', async (req, res) => {
  const entry = entries.get(req.params.token);
  if (!entry || entry.expires <= Date.now()) return res.status(410).json({ error: '音频地址已过期，请重新获取' });
  try {
    const headers = req.headers.range ? { Range: req.headers.range } : {};
    const response = await fetch(entry.url, { headers, signal: AbortSignal.timeout(60000), redirect: 'error' });
    if (!response.ok || !response.body) return res.sendStatus(response.status);
    res.status(response.status);
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      if (response.headers.has(name)) res.set(name, response.headers.get(name));
    }
    res.set('Cache-Control', 'no-store');
    await pipeline(Readable.fromWeb(response.body), res);
  } catch {
    if (!res.headersSent) res.status(502).json({ error: '音频读取失败，请重试' });
    else res.destroy();
  }
});
module.exports = { router, registerAudio };

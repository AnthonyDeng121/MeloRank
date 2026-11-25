const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const { createExternalLyricsRouter } = require('../backend/src/externalLyrics');
const live = process.argv.includes('--live');
let calls = 0, fail = false, records = [];
const app = express(); app.use(express.json());
app.use('/lyrics', createExternalLyricsRouter(live ? fetch : async (url, options) => {
  calls++; assert.equal(new URL(url).hostname, 'lrclib.net');
  assert.equal(options.headers.Cookie, undefined);
  if (fail) throw new Error('timeout');
  return { ok: true, json: async () => records };
}));
const server = app.listen(0, '127.0.0.1', async () => {
 try {
  const request = body => fetch(`http://127.0.0.1:${server.address().port}/lyrics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const track = { title: 'WAP (feat. Megan Thee Stallion)', artists: ['Cardi B', 'Megan Thee Stallion'], duration: 187.541 };
  if (live) {
    const response = await request(track); assert.equal(response.status, 200);
    const data = await response.json(); assert.equal(data.source, 'LRCLIB'); assert.match(data.lyric, /\[\d+:\d{2}/); assert.equal(data.edition, 'explicit', 'live WAP lyrics are not the clean version'); assert.ok(/\bpussy\b/i.test(data.lyric) && !/wet and gushy/i.test(data.lyric), 'WAP chorus matches the explicit recording');
    console.log(`PASS live WAP fallback: synchronized lyrics received (${data.lyric.length} characters)`); return;
  }
  const base = { id: 1, trackName: 'WAP', artistName: 'Cardi B', duration: 188, plainLyrics: 'fixture', syncedLyrics: '[00:01]fixture' };
  records = [{ ...base, trackName: 'WAP (Remix)' }, { ...base, artistName: 'Other' }, { ...base, duration: 234 }, { ...base, instrumental: true }, base];
  assert.equal((await (await request(track)).json()).source, 'LRCLIB');
  await request(track); assert.equal(calls, 1, 'successful matches are cached');
  records = [{ ...base, duration: 190, syncedLyrics: null }];
  assert.equal((await (await request({ ...track, duration: 190 })).json()).lyric, 'fixture', 'plain text is preserved without invented timing');
  records = [{ ...base, trackName: 'WAP (Remix)' }];
  assert.equal((await (await request({ ...track, duration: 186 })).json()).lyric, '', 'wrong recording rejected');
  assert.equal((await request({ ...track, duration: -1 })).status, 400);
  records = [{ ...base, id: 2, duration: 184, syncedLyrics: '[00:01]f***' }, { ...base, id: 3, duration: 185, syncedLyrics: '[00:01]fuck' }];
  const explicit = await (await request({ ...track, duration: 184, explicit: true })).json();
  assert.equal(explicit.edition, 'explicit'); assert.equal(explicit.lyric, '[00:01]fuck');
  assert.equal((await (await request({ ...track, duration: 184, explicit: false })).json()).edition, 'clean');
  records = [{ ...base, duration: 182, syncedLyrics: '[00:01]fuck' }, { ...base, id: 9, duration: 183, syncedLyrics: '[00:01]fuck pussy' }];
  assert.equal((await (await request({ ...track, duration: 182, explicit: true })).json()).sourceUrl, 'https://lrclib.net/api/get/9', 'partially sanitized lyrics must not win by a slightly closer duration');
  records = [{ ...base, trackName: 'WAP (Clean)', syncedLyrics: '[00:01]clean words' }];
  assert.equal((await (await request({ ...track, duration: 183, explicit: true })).json()).lyric, '', 'never substitute a clean-labelled recording for explicit');
  fail = true; assert.equal((await request({ ...track, duration: 180 })).status, 502);
  console.log('PASS overseas matching, duration/version guards, plain lyrics, cache, metadata validation and upstream failure');
 } catch (error) { console.error(error); process.exitCode = 1; } finally { server.close(); }
});

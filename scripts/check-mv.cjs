const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const originalFetch = global.fetch;
const sdkPath = require.resolve('@neteasecloudmusicapienhanced/api', { paths: [require.resolve('../backend/src/mv')] });
const previous = require.cache[sdkPath];
require.cache[sdkPath] = { exports: {
  cloudsearch: async params => { assert.equal(params.type, 1004); assert.equal(params.offset, 20); assert.equal(params.cookie, 'fixture'); return { body: { result: { mvs: [{ id: 1, name: 'MV', duration: 200000 }], mvCount: 25 } } }; },
  mv_detail: async () => ({ body: { data: { name: 'MV', desc: 'Description' } } }),
  mv_url: async () => ({ body: { data: { url: 'https://example.com/mv.mp4' } } }),
} };
const app = express(); app.use(express.json()); app.use('/mv', require('../backend/src/mv'));
const server = app.listen(0, '127.0.0.1', async () => {
  try {
    const request = async (action, body) => originalFetch(`http://127.0.0.1:${server.address().port}/mv/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': 'fixture', 'X-QQ-Music-Cookie': 'qq-fixture' }, body: JSON.stringify(body) });
    assert.equal((await request('search', { provider: 'spotify', query: 'MV' })).status, 400);
    assert.equal((await request('play', { provider: 'netease', id: '../invalid' })).status, 400);
    const result = await (await request('search', { provider: 'netease', query: 'MV', page: 2 })).json();
    assert.equal(result.items[0].duration, 200); assert.equal(result.total, 25);
    assert.equal((await (await request('play', { provider: 'netease', id: '1' })).json()).description, 'Description');
    global.fetch = async (url, options) => {
      assert.equal(options.headers['X-QQ-Music-Cookie'], 'qq-fixture');
      return { ok: true, json: async () => ({ response: { getMVUrl: { data: { fixture: { mp4: [{ code: 0, freeflow_url: ['http://example.com/mv.mp4', 'https://example.com/mv.mp4'] }] } } }, mvinfo: { data: { fixture: { name: 'QQ MV' } } }, playLists: {} } }) };
    };
    const playback = await (await request('play', { provider: 'qq', id: 'fixture' })).json();
    assert.equal(playback.url, 'https://example.com/mv.mp4'); assert.equal(playback.title, 'QQ MV');
    console.log('PASS MV validation, pagination, credentials, metadata and modern QQ playback URLs');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally { global.fetch = originalFetch; if (previous) require.cache[sdkPath] = previous; else delete require.cache[sdkPath]; server.close(); }
});

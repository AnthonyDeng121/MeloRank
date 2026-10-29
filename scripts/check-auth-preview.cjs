const assert = require('node:assert/strict');
const { requestAuth, resolveCookie, getUin } = require('../qq-music-api-main/util/requestAuth');
const modulePath = require.resolve('../qq-music-api-main/module');
const oldModule = require.cache[modulePath];
let calls = [];
let resourceValid = true;
let modern = false;
const probed = [];
const axiosPath = require.resolve('../qq-music-api-main/node_modules/axios');
const originalAxios = require.cache[axiosPath];
require.cache[axiosPath] = { id: axiosPath, filename: axiosPath, loaded: true, exports: { get: async url => {
  probed.push(url);
  if (!resourceValid) throw new Error('CDN 404');
  return { data: Buffer.from('ID3audio-fixture') };
} } };
require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: {
  UCommon: async props => {
    calls.push(props);
    const query = JSON.parse(props.params.data);
    if (query.songinfo) return { data: { songinfo: { data: modern ? { track_info: { file: { media_mid: 'fixtureMedia' } } } : {} } } };
    const preview = query.req_0.param.filename[0].startsWith('RS02');
    return { data: { req_0: { data: { sip: modern ? [] : ['https://example.qq.com/'], midurlinfo: [{ songmid: 'test-mid', purl: preview ? 'RS02test.mp3?vkey=test' : '', result: preview ? 0 : 104003 }] } } } };
  },
} };
const play = require('../qq-music-api-main/routers/context/getMusicPlay');
if (originalAxios) require.cache[axiosPath] = originalAxios; else delete require.cache[axiosPath];
if (oldModule) require.cache[modulePath] = oldModule; else delete require.cache[modulePath];

(async () => {
  global.userInfo = { cookie: 'must-not-be-used' };
  assert.equal(resolveCookie(), '');
  const values = await Promise.all(['uin=11', 'uin=22', ''].map(cookie => requestAuth.run({ cookie }, async () => { await new Promise(resolve => setTimeout(resolve, 5)); return resolveCookie(); })));
  assert.deepEqual(values, ['uin=11', 'uin=22', '']);
  assert.equal(getUin('a=1; uin=o123; key=value'), '123');
  const ctx = { query: { songmid: 'test-mid' }, params: {}, request: { headers: { cookie: 'uin=999' } } };
  await requestAuth.run({ cookie: '' }, () => play(ctx));
  assert.ok(calls.every(call => call.cookie === ''));
  assert.equal(JSON.parse(calls[0].params.data).req_0.param.uin, '0');
  assert.equal(ctx.body.data.playUrl['test-mid'].isPreview, true);
  assert.equal(ctx.body.data.playUrl['test-mid'].previewLimit, 30);
  resourceValid = false;
  const broken = { ...ctx };
  await requestAuth.run({ cookie: '' }, () => play(broken));
  assert.equal(broken.body.data.playUrl['test-mid'].url, '');
  assert.equal(broken.body.data.playUrl['test-mid'].isPreview, false);
  resourceValid = true; modern = true; calls = []; probed.length = 0;
  await requestAuth.run({ cookie: '' }, () => play(ctx));
  assert.ok(calls.some(call => JSON.parse(call.params.data).req_0?.param.filename[0] === 'RS02fixtureMedia.mp3'));
  assert.ok(probed[0].startsWith('https://isure.stream.qqmusic.qq.com/'));
  assert.equal(ctx.body.data.playUrl['test-mid'].isPreview, true);
  calls = [];
  const noPreview = { ...ctx, query: { songmid: 'test-mid', preview: '0' } };
  await requestAuth.run({ cookie: 'uin=11; qm_keyst=fixture' }, () => play(noPreview));
  assert.equal(calls.length, 1);
  assert.equal(noPreview.body.data.playUrl['test-mid'].url, '');
  console.log('PASS isolated concurrent credentials, guest ignores stale cookies, provider-only preview and disabled preview');
})().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const { requestAuth, resolveCookie, getUin } = require('../qq-music-api-main/util/requestAuth');
const modulePath = require.resolve('../qq-music-api-main/module');
const oldModule = require.cache[modulePath];
let calls = [];
require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: {
  UCommon: async props => {
    calls.push(props);
    const preview = JSON.parse(props.params.data).req_0.param.filename[0].startsWith('RS02');
    return { data: { req_0: { data: { sip: ['https://example.qq.com/'], midurlinfo: [{ songmid: 'test-mid', purl: preview ? 'RS02test.mp3?vkey=test' : '', result: preview ? 0 : 104003 }] } } } };
  },
} };
const play = require('../qq-music-api-main/routers/context/getMusicPlay');
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
  calls = [];
  const noPreview = { ...ctx, query: { songmid: 'test-mid', preview: '0' } };
  await requestAuth.run({ cookie: 'uin=11; qm_keyst=fixture' }, () => play(noPreview));
  assert.equal(calls.length, 1);
  assert.equal(noPreview.body.data.playUrl['test-mid'].url, '');
  console.log('PASS isolated concurrent credentials, guest ignores stale cookies, provider-only preview and disabled preview');
})().catch(error => { console.error(error); process.exitCode = 1; });

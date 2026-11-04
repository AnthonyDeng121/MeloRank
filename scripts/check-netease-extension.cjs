const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const manifest = JSON.parse(fs.readFileSync('browser-extension/netease-login/manifest.json', 'utf8'));
assert.deepEqual(manifest.permissions, ['cookies']);
assert.deepEqual(manifest.host_permissions, ['https://music.163.com/*']);
let listener, reads = 0, opened = [], active = [];
const chrome = {
  runtime: { onMessage: { addListener: fn => { listener = fn; } } },
  tabs: { create: async options => opened.push(options), update: async id => active.push(id), onRemoved: { addListener() {} } },
  cookies: { getAll: async options => { reads++; assert.equal(options.url, 'https://music.163.com/'); return [{ name: 'MUSIC_U', value: 'fixture' }, { name: '__csrf', value: 'fixture-csrf' }, { name: 'other', value: 'never-transfer' }]; } },
};
vm.runInNewContext(fs.readFileSync('browser-extension/netease-login/background.js', 'utf8'), { chrome, URL, Map, Set, Date });
const sender = { frameId: 0, tab: { id: 7 }, url: 'http://127.0.0.1:5188/' };
const send = (action, from = sender) => new Promise(resolve => {
  if (listener({ type: 'melorank-netease', action }, from, resolve) !== true) resolve(undefined);
});
(async () => {
  for (const url of ['https://evil.example', 'http://127.0.0.1:9999/', 'http://localhost.evil:5188/']) assert.equal(await send('begin', { ...sender, url }), undefined);
  assert.equal(await send('begin', { ...sender, frameId: 1 }), undefined);
  assert.equal((await send('read')).ok, false);
  assert.equal(reads, 0);
  assert.equal((await send('begin')).ok, true);
  assert.equal(opened[0].url, 'https://music.163.com/#/login');
  const result = await send('read');
  assert.equal(result.cookie, 'MUSIC_U=fixture; __csrf=fixture-csrf;');
  assert.equal(active[0], 7);
  assert.equal((await send('read')).ok, false, 'Credential transfer is single use');
  await send('begin'); await send('cancel');
  assert.equal((await send('read')).ok, false);
  console.log('PASS extension scope, user-initiated connection, credential filtering, single-use transfer and cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });

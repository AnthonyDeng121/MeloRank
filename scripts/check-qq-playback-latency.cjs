const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const file = path.resolve('qq-music-api-main/routers/context/getMusicPlay.js');
const localRequire = createRequire(file);

async function run(mode) {
  const calls = [];
  const sandbox = { module: { exports: {} }, Buffer, console, require(name) {
    if (name === '../../module') return { UCommon: async props => {
      const query = JSON.parse(props.params.data); calls.push(query);
      if (query.songinfo) return { data: { songinfo: { data: { track_info: { file: { media_mid: 'media' } } } } } };
      const legacy = query.req_0.module === 'vkey.GetVkeyServer' && calls.length > 1;
      const success = mode === 'full' || (mode === 'modern' ? query.req_0.module === 'music.vkey.GetVkey' : legacy);
      return { data: { req_0: { data: { sip: ['https://audio.test/'], midurlinfo: [{ songmid: 'track', purl: success ? 'audio.mp3' : '', result: 0 }] } } } };
    } };
    if (name === '../../module/config') return { _guid: 'test' };
    if (name === '../../util/requestAuth') return { resolveCookie: () => '', getUin: () => '0' };
    if (name === 'axios') return { get: async () => ({ data: Buffer.from('ID3test') }) };
    return localRequire(name);
  } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
  const ctx = { query: { songmid: 'track' }, params: {} };
  await sandbox.module.exports(ctx);
  assert.equal(ctx.body.data.playUrl.track.url, 'https://audio.test/audio.mp3');
  assert.equal(ctx.body.data.playUrl.track.isPreview, mode !== 'full');
  return calls;
}
(async () => {
  assert.equal((await run('full')).length, 1);
  assert.equal((await run('modern')).length, 3);
  assert.equal((await run('legacy')).length, 5);
  console.log('PASS full playback uses one request; successful modern preview skips legacy; legacy fallback remains available');
})().catch(error => { console.error(error); process.exitCode = 1; });

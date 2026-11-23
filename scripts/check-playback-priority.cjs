const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
let original, calls = 0;
const sandbox = { exports: {},
  qqMusicService: { getSongUrl: async () => { if (original instanceof Error) throw original; return original; } },
  netease: { alternative: async () => { calls++; return { url: 'https://alternative.test/audio', source: 'test' }; } },
};
vm.createContext(sandbox);
const source = fs.readFileSync('src/app/services/platformSongs.ts', 'utf8').replace(/^import .*;\r?\n/gm, '');
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }).replace(/export /g, ''), sandbox);
(async () => {
  const song = { songmid: 'qq-id', songname: 'Disease', singer: [{ name: 'Lady Gaga' }] };
  for (const isPreview of [false, true]) {
    original = { data: { playUrl: { 'qq-id': { url: 'https://qq.test/audio', isPreview } } } };
    assert.equal(await sandbox.platformSongUrl(song), original);
    assert.equal(calls, 0, 'native audio and previews must not be replaced');
  }
  original = new Error('network timeout');
  await assert.rejects(() => sandbox.platformSongUrl(song), /network timeout/);
  assert.equal(calls, 0, 'network errors must not cause source switching');
  original = { data: { playUrl: { 'qq-id': { url: '' } } } };
  await sandbox.platformSongUrl(song);
  assert.equal(calls, 1, 'an explicit empty native result permits fallback');
  console.log('PASS native full audio, native preview, network failure and empty-result fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });

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
  original = { data: { playUrl: { 'qq-id': { url: 'https://qq.test/audio', isPreview: false } } } };
  assert.equal(await sandbox.platformSongUrl(song), original);
  assert.equal(calls, 0);
  original.data.playUrl['qq-id'].isPreview = true;
  assert.notEqual(await sandbox.platformSongUrl(song), original);
  assert.equal(calls, 1, 'previews must try full alternative audio');
  original = new Error('network timeout');
  await sandbox.platformSongUrl(song);
  assert.equal(calls, 2, 'restore fallback after native request failures');
  original = { data: { playUrl: { 'qq-id': { url: '' } } } };
  await sandbox.platformSongUrl(song);
  assert.equal(calls, 3);
  sandbox.netease.alternative = async () => { throw new Error('no full audio'); };
  original = { data: { playUrl: { 'qq-id': { url: 'preview', isPreview: true } } } };
  assert.equal(await sandbox.platformSongUrl(song), original, 'retain preview only after all full sources fail');
  console.log('PASS full native, preview replacement, request failure fallback, and final preview recovery');
})().catch(error => { console.error(error); process.exitCode = 1; });

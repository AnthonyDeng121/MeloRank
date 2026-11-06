const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

let candidates = [], requests = 0, fail = false;
const search = async () => {
  requests++;
  if (fail) throw new Error('network');
  return { response: { data: { song: { list: candidates } } } };
};
const sandbox = {
  exports: {}, console, URLSearchParams,
  require: name => name === './qqMusicService' ? { qqMusicService: { searchWithType: search } } : {
    netease: { request: async () => ({ songs: candidates, total: candidates.length }) },
    spotify: { request: async () => ({ tracks: { items: candidates, total: candidates.length } }) },
  },
};
vm.createContext(sandbox);
vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/services/platformSongs.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox);
const { resolvePlaybackSong } = sandbox.exports;
const source = { provider: 'netease', songmid: 'netease:1', songname: 'Song', singer: [{ name: 'Artist', mid: '' }], albumname: 'Album', albummid: '', duration: 200 };
const candidate = { songmid: 'qq-id', songname: 'Song', singer: [{ name: 'Artist', mid: '' }], albumname: 'Album', duration: 200 };

(async () => {
  assert.strictEqual(await resolvePlaybackSong(source, 'netease'), source);
  assert.equal(requests, 0);
  candidates = [{ ...candidate, singer: [{ name: 'Other' }] }, { ...candidate, songname: 'Song (Live)' }, candidate];
  const [first, second] = await Promise.all([resolvePlaybackSong(source, 'qq'), resolvePlaybackSong(source, 'qq')]);
  assert.equal(first.songmid, 'qq-id'); assert.strictEqual(first, second); assert.equal(requests, 1);
  assert.equal(source.songmid, 'netease:1'); assert.equal(first.provider, 'qq');
  candidates = [{ ...candidate, duration: 230 }];
  await assert.rejects(resolvePlaybackSong({ ...source, songmid: 'duration' }, 'qq'), /未找到/);
  candidates = [candidate, { ...candidate, songmid: 'duplicate' }];
  await assert.rejects(resolvePlaybackSong({ ...source, songmid: 'ambiguous' }, 'qq'), /多个版本/);
  fail = true;
  const retry = { ...source, songmid: 'retry' };
  await assert.rejects(resolvePlaybackSong(retry, 'qq'), /network/);
  fail = false; candidates = [candidate];
  assert.equal((await resolvePlaybackSong(retry, 'qq')).songmid, 'qq-id');
  candidates = [{ id: 42, name: 'Song', ar: [{ name: 'Artist' }], al: { name: 'Album' }, dt: 200000 }];
  assert.equal((await resolvePlaybackSong({ ...candidate, provider: 'qq' }, 'netease')).songmid, 'netease:42');
  candidates = [{ id: 'sp-id', name: 'Song', artists: [{ name: 'Artist' }], album: { name: 'Album' }, duration_ms: 200000 }];
  assert.equal((await resolvePlaybackSong(source, 'spotify')).uri, 'spotify:track:sp-id');
  console.log('PASS playback sources: identity, catalog match, cache, version rejection, retry, QQ/Netease/Spotify');

  const context = fs.readFileSync('src/app/contexts/MusicContext.tsx', 'utf8');
  const ast = ts.createSourceFile('MusicContext.tsx', context, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let resolutionEffect;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('resolvePlaybackSong(')) resolutionEffect = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(resolutionEffect);
  const pending = [];
  const model = {
    currentSong: source, activeProvider: 'qq', playbackGeneration: { current: 0 },
    audioRef: { current: { pause() {} } }, spotifyPlayback: { disconnect() {} },
    setPlaybackSong(value) { model.resolved = value; }, setPlaybackNotice() {}, setLyrics() {}, setCurrentTime() {}, setDuration() {}, setIsPlaying() {},
    resolvePlaybackSong: () => new Promise(resolve => pending.push(resolve)), toast: { error() { throw new Error('Unexpected error'); } },
  };
  vm.createContext(model);
  vm.runInContext(ts.transpile(`globalThis.effect = ${resolutionEffect}`, { target: ts.ScriptTarget.ES2022 }), model);
  const cleanup = model.effect();
  cleanup(); model.currentSong = { ...source, songmid: 'new-track' }; model.effect();
  pending[1]({ ...candidate, songmid: 'new-match' });
  await new Promise(resolve => setImmediate(resolve));
  pending[0](candidate);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(model.resolved.songmid, 'new-match');
  console.log('PASS late catalog matches cannot replace the newly selected track');
})().catch(error => { console.error(error); process.exitCode = 1; });

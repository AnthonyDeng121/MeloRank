const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = ts.createSourceFile('MusicContext.tsx', fs.readFileSync('src/app/contexts/MusicContext.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let clear, effect;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'clearPlayQueue') clear = node.initializer.getText(source);
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('const playSong =')) effect = node.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(clear && effect);
let resolveRequest, plays = 0, pauses = 0, loads = 0;
const model = { console, alert() { throw new Error('Unexpected playback error'); },
  playbackGeneration: { current: 0 }, currentSong: { songmid: 'pending' },
  audioRef: { current: { src: '', pause() { pauses++; }, load() { loads++; }, removeAttribute() { this.src = ''; }, play() { plays++; return Promise.resolve(); } } },
  qqMusicService: { getSongUrl: () => new Promise(resolve => { resolveRequest = resolve; }) },
};
for (const key of ['IsPlaying', 'CurrentTime', 'Duration', 'Lyrics', 'PlayQueue', 'CurrentIndex', 'CurrentSong']) model['set' + key] = value => { model[key] = value; };
vm.createContext(model);
vm.runInContext(ts.transpile(`globalThis.clear = ${clear}; globalThis.effect = ${effect};`, { target: ts.ScriptTarget.ES2020 }), model);
(async () => {
  model.effect();
  model.clear();
  assert.equal(model.IsPlaying, false); assert.equal(model.CurrentSong, null); assert.equal(model.PlayQueue.length, 0);
  assert.equal(model.audioRef.current.src, ''); assert.ok(pauses && loads);
  resolveRequest({ url: 'https://example.com/late.mp3' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(plays, 0); assert.equal(model.audioRef.current.src, '');
  console.log('PASS clearing stops audio immediately and late URL responses cannot restart playback');
})().catch(error => { console.error(error); process.exitCode = 1; });

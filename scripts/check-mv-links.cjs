const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const React = require('react');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.VITE_BACKEND_API_URL', "'http://fixture'"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const matching = {};
vm.runInNewContext(compile('src/app/services/mvMatching.ts'), { exports: matching });
const original = { title: 'Test Song (Official Music Video)', artist: 'Singer' };
const remix = { title: 'Test Song Remix', artist: 'Singer' };
assert.equal(matching.uniqueMVMatch([original, remix], 'Test Song', 'Singer', item => item), original);
assert.equal(matching.uniqueMVMatch([original, original], 'Test Song', 'Singer', item => item), undefined);
assert.equal(matching.uniqueMVMatch([original], 'Test Song', 'Other Artist', item => item), undefined);
assert.equal(matching.uniqueMVMatch([remix], 'Test Song', 'Singer', item => item), undefined);
for (const audioOnly of [false, true]) {
  let index = 0;
  let pausedSong = false;
  const mock = { ...React, useCallback: callback => callback, useEffect: () => {}, useRef: () => ({ current: null }), useState: initial => { index++; return [index === 1 ? true : index === 4 ? audioOnly : index === 5 ? 'fixture.mp4' : initial, () => {}]; } };
  mock.default = mock;
  for (const provider of ['qq', 'netease']) {
    index = 0;
    const exports = {};
    vm.runInNewContext(compile('src/app/components/MVBrowser.tsx'), { exports, require: name => name === 'react' ? mock : name.includes('mvMatching') ? matching : name.includes('PlatformAccounts') ? { usePlatformAccounts: () => ({ activeProvider: provider }) } : name.includes('MusicContext') ? { useMusic: () => ({ isPlaying: true, togglePlay: () => { pausedSong = true; } }) } : {}, AbortSignal });
    const tree = exports.MVPlayer({ item: { provider: 'qq', id: 'fixture', title: 'Test', artist: 'Singer' } });
    if (provider !== 'qq') { assert.equal(tree, null, 'platform changes must unmount the stale MV'); continue; }
    let media;
    const visit = node => { if (!node || typeof node !== 'object') return; if (node.type === (audioOnly ? 'audio' : 'video')) media = node; React.Children.forEach(node.props?.children, visit); };
    visit(tree);
    assert.ok(media); assert.equal(media.props.loop, true); assert.notEqual(media.props.autoPlay, true);
    const element = { volume: 1, autoplay: true }; media.ref(element);
    assert.equal(element.volume, .2); assert.equal(element.autoplay, false);
    media.props.onPlay(); assert.equal(pausedSong, true);
  }
}
console.log('PASS: unique matching, alternate versions, artist mismatch, MV loop, quiet entry, audio-only and platform clearing');

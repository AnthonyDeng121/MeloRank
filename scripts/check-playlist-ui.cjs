// Exercise the actual React handlers against an isolated hook/DOM model.
// This does not control a browser or replace visual/touchscreen acceptance.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function compile(file, globals = {}, modules = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, { exports, require: name => { if (!(name in modules)) throw Error(`Unexpected module ${name}`); return modules[name]; }, crypto: require('node:crypto'), ...globals });
  return exports;
}
const utils = compile('src/app/utils/playlistRanking.ts');
function harness(provider) {
  const slots = [], effects = [], listeners = new Map(), memory = new Map();
  const calls = []; let cursor = 0, tree, hovered = '', saving = false, navigated, opened;
  let tracks = Array.from({ length: 30 }, (_, index) => ({ id: String(index + 1), title: `Song ${index}`, subtitle: 'Artist', song: { provider, providerId: String(index + 1), songmid: `m${index}`, songname: `Song ${index}`, singer: [{ name: 'Artist' }], albumId: String(index % 2), albumname: `Album ${index % 2}`, duration: 181 } }));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat(Infinity) } }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useEffect(effect, deps) { const index = cursor++, previous = slots[index]; if (!previous || deps.some((value, at) => value !== previous.deps[at])) { effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: effect() }; }); } },
  };
  const request = async (_, body) => { calls.push(body); return { success: true }; };
  const window = { addEventListener: (type, handler) => listeners.set(type, handler), removeEventListener: type => listeners.delete(type), scrollBy() {} };
  const localStorage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  memory.set('yearlyRankings', JSON.stringify([{ id: 'keep-existing', name: 'Keep' }]));
  const { PlaylistEditor } = compile('src/app/components/PlaylistEditor.tsx', {
    window, document: { body: { style: {} }, elementFromPoint: () => ({ closest: () => ({ dataset: { playlistTrack: hovered } }) }) }, innerHeight: 800,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, localStorage, AbortSignal,
    fetch: async (_, options) => ({ ok: true, json: () => request('', JSON.parse(options.body)) }),
  }, {
    react, 'lucide-react': {}, '../utils/coverUpload': { prepareCoverUpload: async () => 'data:image/jpeg;base64,/9j/AAECAwQ=' }, '../services/musicPlatforms': { netease: { request } }, '../services/qqMusicConfig': { QQ_MUSIC_CONFIG: { baseUrl: 'https://fixture.invalid' } },
    '../services/platformSongs': { songCover: () => '', searchPlatform: async () => ({}) }, '../contexts/RankingContext': { useRankingContext: () => ({ setPendingRanking: record => { opened = record; } }) }, '../utils/playlistRanking': utils,
  });
  const render = () => {
    cursor = 0; effects.length = 0;
    tree = PlaylistEditor({ provider, playlist: { id: '9', title: 'Fixture playlist' }, tracks, ready: true, saving, setSaving: value => { saving = value; }, reload: async () => { const ids = calls.at(-1)?.ids; if (ids) tracks = ids.map(id => tracks.find(track => track.id === id)); }, asSong: track => track.song, playing: () => false, play() {}, onNavigate: page => { navigated = page; } });
    for (const effect of [...effects]) effect(); return tree;
  };
  const nodes = () => { const result = []; const visit = node => { if (!node || typeof node !== 'object') return; result.push(node); node.props?.children?.forEach(visit); }; visit(tree); return result; };
  const find = predicate => { const node = nodes().find(predicate); assert.ok(node, 'UI node exists'); return node; };
  const byLabel = label => find(node => node.props?.['aria-label'] === label);
  const textButton = text => find(node => node.type === 'button' && node.props.children.includes(text));
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  render();
  return { render, byLabel, textButton, find, settle, calls, memory, listeners, hover: id => { hovered = id; }, getTracks: () => tracks, getOpened: () => opened, getNavigation: () => navigated };
}
async function run(provider) {
  const ui = harness(provider);
  const handle = ui.byLabel('拖动 Song 0 调整顺序');
  handle.props.onPointerDown({ button: 0, pointerId: 1, clientX: 10, clientY: 150, preventDefault() {}, currentTarget: { setPointerCapture() {} } });
  ui.render(); ui.hover('30'); ui.listeners.get('pointermove')({ pointerId: 1, clientX: 10, clientY: 650 }); ui.render();
  assert.equal(ui.calls.length, 0, 'moving previews without network writes');
  ui.listeners.get('pointerup')({ pointerId: 1 });
  await ui.settle();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].action, 'reorder'); assert.equal(ui.calls[0].ids[29], '1');
  assert.equal(ui.calls[0].baseIds[0], '1'); assert.equal(ui.getTracks()[29].id, '1');
  let keyHandle = ui.byLabel('拖动 Song 0 调整顺序');
  keyHandle.props.onKeyDown({ key: ' ', preventDefault() {} }); ui.render();
  ui.byLabel('拖动 Song 0 调整顺序').props.onKeyDown({ key: 'ArrowUp', preventDefault() {} }); ui.render();
  ui.listeners.get('keydown')({ key: 'Escape' }); await ui.settle(); assert.equal(ui.calls.length, 1, 'cancel never saves');
  ui.textButton('保存年度榜单').props.onClick(); ui.render();
  ui.find(node => node.type === 'select' && node.props.value === 'songs').props.onChange({ target: { value: 'albums' } }); ui.render();
  ui.find(node => node.type === 'select' && node.props.value === 'scoring').props.onChange({ target: { value: 'non-scoring' } }); ui.render();
  ui.byLabel('保存年度榜单').props.onSubmit({ preventDefault() {} }); ui.render();
  const saved = JSON.parse(ui.memory.get('yearlyRankings'));
  assert.equal(saved[0].id, 'keep-existing'); assert.equal(saved.length, 2); assert.equal(saved[1].scoringMode, 'non-scoring');
  assert.equal(saved[1].type, '年度专辑榜'); assert.equal(saved[1].rankingList.length, 2);
  assert.ok(saved[1].rankingList.every(item => item.originalScore === 0 && item.finalScore === 0));
  assert.equal(ui.getOpened(), undefined, 'saving does not replace the active draft');
  ui.textButton('打开榜单').props.onClick(); assert.equal(ui.getOpened().id, saved[1].id); assert.equal(ui.getNavigation(), 'yearly-ranking');
  ui.textButton('编辑歌单').props.onClick(); ui.render();
  await ui.find(node => node.type === 'input' && node.props.type === 'file').props.onChange({ target: { files: [{}], value: 'fixture.jpg' } }); ui.render();
  assert.equal(ui.find(node => node.type === 'img' && node.props.className === 'playlist-upload-preview').props.src, 'data:image/jpeg;base64,/9j/AAECAwQ=');
  ui.byLabel('编辑歌单').props.onSubmit({ preventDefault() {} }); await ui.settle();
  assert.equal(ui.calls.at(-1).coverData, 'data:image/jpeg;base64,/9j/AAECAwQ=');
  assert.equal(ui.calls.at(-1).action, 'metadata');
  ui.textButton('添加歌曲').props.onClick(); const tree = ui.render();
  assert.equal(ui.byLabel('搜索歌曲').props.children.some(child => typeof child === 'string' && child.trim()), false, 'search is icon only');
  assert.equal(JSON.stringify(tree).includes('键盘空格'), false, 'visible drag instruction removed');
  assert.equal(JSON.stringify(tree).includes('编辑 Song'), false, 'row edit menu removed');
  console.log(`PASS ${provider} actual handlers: drag previews, one drop write, cancellation, save new album ranking, zero scores, explicit open`);
}
(async () => { await run('qq'); await run('netease'); })().catch(error => { console.error(error); process.exitCode = 1; });

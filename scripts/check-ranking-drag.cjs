const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const utils = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/utils/playlistRanking.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: utils });
const slots = [], effects = [], listeners = new Map(), timers = [];
let cursor = 0, hovered = 'c', saved = 0, items = ['a', 'b', 'c'].map((id, index) => ({ id, rank: index + 1, originalScore: 90 - index, review: id }));
const react = {
  useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
  useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
  useEffect(effect, deps) { const index = cursor++; if (!(index in slots)) { slots[index] = deps; effects.push(effect); } },
};
const exportsObject = {}, body = { style: { userSelect: '' } };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/hooks/useRankingDrag.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: exportsObject, require: name => name === 'react' ? react : utils,
  document: { body, elementFromPoint: () => ({ closest: () => ({ dataset: { rankingDrag: hovered } }) }) },
  window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), scrollBy() {} }, innerHeight: 800,
  requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout: fn => timers.push(fn),
});
const render = () => { cursor = 0; effects.length = 0; const result = exportsObject.useRankingDrag(items, next => { saved++; items = Array.from(next, (item, index) => ({ ...item, rank: index + 1 })); }); effects.forEach(effect => effect()); return result; };
const event = (x = 0, target = { closest: () => null }) => ({ button: 0, pointerId: 1, pointerType: 'mouse', clientX: x, clientY: 100, target });
let drag = render();
drag.bind('a').onPointerDown(event()); listeners.get('pointermove')(event(3)); listeners.get('pointerup')(event(3)); assert.equal(saved, 0, 'clicks do not reorder');
drag = render(); drag.bind('a').onPointerDown(event()); listeners.get('pointermove')(event(20)); drag = render();
assert.equal(drag.items[2].id, 'a'); assert.equal(items[0].id, 'a', 'movement is preview only');
listeners.get('pointerup')(event(20)); assert.equal(saved, 1); assert.deepEqual(items.map(item => item.id), ['b', 'c', 'a']);
assert.deepEqual(items.map(item => item.rank), [1, 2, 3]); assert.equal(items[2].originalScore, 90); assert.equal(items[2].review, 'a');
let suppressed = false; render().bind('a').onClickCapture({ preventDefault: () => { suppressed = true; }, stopPropagation() {} }); assert.equal(suppressed, true); timers.splice(0).forEach(fn => fn());
hovered = 'b'; drag = render(); drag.bind('a').onPointerDown(event()); listeners.get('pointermove')(event(20)); listeners.get('keydown')({ key: 'Escape' }); assert.equal(saved, 1);
drag = render(); drag.bind('a').onPointerDown(event()); listeners.get('pointermove')(event(20)); items = items.map(item => item.id === 'a' ? { ...item, originalScore: 99 } : item); render(); listeners.get('pointerup')(event(20)); assert.equal(saved, 1, 'external edits invalidate stale drag'); assert.equal(items[2].originalScore, 99);
drag = render(); drag.bind('a').onPointerDown(event(0, { closest: () => ({ tagName: 'BUTTON' }) })); listeners.get('pointermove')(event(20)); listeners.get('pointerup')(event(20)); assert.equal(saved, 1, 'buttons do not begin dragging');
const row = {}; render().bind('a').onKeyDown({ target: row, currentTarget: row, altKey: true, key: 'ArrowUp', preventDefault() {} }); assert.equal(saved, 2); assert.equal(items[1].id, 'a');
console.log('PASS annual ranking drag: threshold, preview, drop, ranks, unchanged scores/reviews, cancel, preserve external edits, interactive controls and keyboard');

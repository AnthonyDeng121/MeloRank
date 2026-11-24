const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let states = [], cursor = 0, effectKeys = [], effects = [], effectCursor = 0, exportsMade = 0;
const memory = new Map([['melorank:work-review:v1:fixture', JSON.stringify({ score: '8', text: 'saved review', tracks: {} })]]);
const react = {
 createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'fragment',
 useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
 useEffect: (callback, keys) => { const index = effectCursor++, key = JSON.stringify(keys); if (effectKeys[index] !== key) { effects.push(callback); effectKeys[index] = key; } },
};
const Modal = () => null;
const sandbox = { exports: {}, localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) }, require: path => {
 if (path === 'react') return { __esModule: true, default: react, ...react };
 if (path === 'sonner') return { toast: { success() {}, error() {} } };
 if (path === 'file-saver') return { saveAs: () => exportsMade++ };
 if (path === './Modal') return { Modal };
 if (path === '../services/reviewCard') return { renderReviewCard: async () => ({ toBlob: callback => callback({}) }) };
 throw new Error(path);
} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/components/WorkReview.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
let tree;
function render(inline = true) { cursor = 0; effectCursor = 0; tree = sandbox.exports.WorkReview({ id: 'fixture', title: 'Song', artist: 'Artist', image: '', inline }); for (const effect of effects.splice(0)) effect(); }
function nodes(value = tree) { if (!value || typeof value !== 'object') return []; if (Array.isArray(value)) return value.flatMap(nodes); return [value, ...nodes(value.props?.children)]; }
(async () => {
 render(); render();
 assert.ok(!nodes().some(n => n.type === Modal), 'inline form does not open a modal');
 assert.equal(nodes().find(n => n.type === 'input').props.value, '8', 'existing review loaded');
 nodes().find(n => n.type === 'input').props.onChange({ target: { value: '9' } }); render();
 nodes().find(n => n.type === 'textarea').props.onChange({ target: { value: 'edited review' } }); render();
 tree.props.onBlur(); assert.equal(JSON.parse(memory.values().next().value).text, 'edited review');
 const button = nodes().find(n => n.type === 'button'); assert.equal(button.props.children.join(''), '\u5bfc\u51fa\u4e50\u8bc4');
 button.props.onClick(); await new Promise(resolve => setImmediate(resolve)); assert.equal(exportsMade, 1, 'export handler generates and downloads the card');
 assert.equal(JSON.parse(memory.values().next().value).score, '9');
 states = []; effectKeys = []; render(false); assert.equal(nodes().filter(n => n.type === 'input').length, 0, 'album modal stays closed until requested');
 console.log('PASS inline review load/edit/persistence/export and retained modal entry');
})().catch(error => { console.error(error); process.exitCode = 1; });

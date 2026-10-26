const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const JSZip = require('jszip');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZp8AAAAASUVORK5CYII=';
class ImageStub { set src(value) { queueMicrotask(() => this.onload?.()); } }
const canvasContext = { fillRect() {}, drawImage() {}, fillText() {}, beginPath() {}, arc() {}, stroke() {} };
const output = { exports: {} };
const source = fs.readFileSync('src/app/services/rankingExport.ts', 'utf8').replaceAll('import.meta.env', '({})');
vm.runInNewContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), {
  exports: output.exports, require: name => name === 'file-saver' ? { saveAs() {} } : require(name),
  document: { createElement: () => ({ getContext: () => canvasContext, toDataURL: () => png }) },
  Image: ImageStub, fetch, Uint8Array, atob, URL, setTimeout, clearTimeout, queueMicrotask, console,
});
(async () => {
  const items = Array.from({ length: 5 }, (_, index) => ({ id: `${index}`, rank: index + 1, title: `标题 ${index + 1}`, artist: 'Kep1er',
    originalScore: 55.4, integrity: 0, durability: 0, finalScore: 5, review: '', coverUrl: png }));
  for (const scoring of [true, false]) {
    const blob = await output.exports.buildRankingDocx(items, scoring);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    assert.equal((xml.match(/<w:sectPr>/g) || []).length, scoring ? 2 : 1);
    assert.ok(xml.includes('w:top="720"') && xml.includes('w:left="720"'));
    assert.ok((xml.match(/<w:cantSplit/g) || []).length >= (scoring ? 15 : 3));
    for (const item of items) assert.ok(xml.includes(item.title), item.title);
    for (const file of Object.values(zip.files).filter(file => file.name.startsWith('word/media/') && !file.dir)) {
      assert.equal((await file.async('nodebuffer')).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    }
  }
  console.log('PASS actual DOCX package: scored/unscored pagination, all titles, narrow margins, atomic rows and real PNG media');
})().catch(error => { console.error(error); process.exitCode = 1; });

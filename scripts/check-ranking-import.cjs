const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const moduleModel = { exports: {} };
vm.runInNewContext(ts.transpile(fs.readFileSync('src/app/utils/rankingImport.ts', 'utf8'), { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }), { exports: moduleModel.exports });
const { parseRankingText } = moduleModel.exports;
const fixture = fs.readFileSync('scripts/fixtures/ranking-import-2026.txt', 'utf8');
const result = parseRankingText(fixture);
assert.equal(result.errors.length, 0, result.errors.join('\n'));
assert.equal(result.items.length, 91);
const expected = [
  ['Not Anymore', '16', 43], ['CRACK CODE', 'Kep1er', 55.4], ['SET', 'B1A4', 54.8],
  ['Lemon Tang', 'Hearts2Hearts', 67.67], ['PINK TAPE', 'H1GHR MUSIC', 37.33],
  ['Cheetah', 'Red Velvet - IRENE & SEULGI', 53.8], ["Imperfect-I'mperfect", 'FIFTY FIFTY', 62.5],
  ["1'ONLY", 'ONE PACT', 60], ['4th', '金惠林', 72.75], ['다시 불러 봄 (Bloom Again)', 'Roy Kim', 66],
];
for (const [title, artist, score] of expected) {
  const item = result.items.find(item => item.title === title);
  assert.ok(item, title); assert.equal(item.artist, artist); assert.equal(item.originalScore, score);
}
assert.equal(result.items.find(item => item.title === 'RE : LOVE').integrity, 2);
assert.equal(parseRankingText('Title - Artist 90 + 1 ++ 2').items[0].durability, 2);
assert.equal(parseRankingText('Title - Artist 90++2').items[0].durability, 2);
assert.equal(parseRankingText('Title - 16').items[0].artist, '16');
assert.equal(parseRankingText('Title - Artist 1975', false).items[0].artist, 'Artist 1975');
assert.equal(parseRankingText('1. 2.6 Title - Kep1er 50').items[0].title, 'Title');
assert.equal(parseRankingText('1.5 - Artist 50').items[0].title, '1.5');
for (const text of ['Title - Artist 66+2+1', 'Title - Artist 66+3', 'Title - Artist -2', 'Title Artist 30']) assert.ok(parseRankingText(text).errors.length, text);
console.log('PASS all 91 supplied lines, numeric artists, dates, Unicode whitespace, hyphens, bonuses and invalid input');

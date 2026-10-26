// Exercise actual page handlers with an isolated in-memory browser/storage model.
// No user browser data, network requests, or production records are modified.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const source = ts.createSourceFile('YearlyRanking.tsx', fs.readFileSync('src/app/pages/YearlyRanking.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'YearlyRanking');
const names = ['saveRanking', 'handleSaveClick', 'handleSaveAsClick', 'renameHistoryRanking', 'loadHistoryRanking', 'customSort', 'calculateLinearScores', 'handleImportRanking', 'moveItemUp', 'moveItemDown', 'handleSubmit'];
const declarations = new Map();
for (const statement of component.body.statements.filter(ts.isVariableStatement)) {
  for (const declaration of statement.declarationList.declarations) {
    if (names.includes(declaration.name.text)) declarations.set(declaration.name.text, declaration.initializer.getText(source));
  }
}
assert.equal(declarations.size, names.length);
const code = [...declarations].map(([name, expression]) => `const ${name} = ${expression};`).join('\n') + `\nglobalThis.handlers = {${names.join(',')}};`;
const memory = new Map();
let form;
let deferUpdates = false;
const pendingUpdates = [];
let clock = Date.now();
class TestDate extends Date { static now() { return clock += 100; } }
const model = {
  parseRankingText: (() => {
    const output = { exports: {} };
    vm.runInNewContext(ts.transpile(fs.readFileSync('src/app/utils/rankingImport.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }), { exports: output.exports });
    return output.exports.parseRankingText;
  })(),
  setImportError() {}, fillImportedCovers() {}, coverGeneration: { current: 0 }, setCoverProgress() {},
  console, Date: TestDate, Math, JSON, parseFloat, parseInt,
  currentYear: 2026, rankingMode: '年度专辑榜', scoringMode: 'scoring',
  rankingList: [], currentRankingId: null, currentRankingName: null,
  showSaveDialog: false, rankingName: '', newRankingName: '', renamingRankingId: null,
  coverUrl: '/artists/images/LG2.jpg', editMode: false, editingItemId: null,
  importedRankingText: '', integrityRef: { current: { value: '0' } }, durabilityRef: { current: { value: '0' } },
  DEFAULT_RANKING_LIST: [{ coverUrl: 'default' }],
  localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
  setTimeout: () => 0,
  alert: message => { throw new Error('Unexpected alert: ' + message); },
  qqMusicService: { searchWithType: () => { throw new Error('Existing covers must not trigger search'); } },
  document: { querySelector: () => form },
};
for (const field of ['IsSaving', 'SaveSuccess', 'ShowSaveDialog', 'RankingName', 'HistoryRankings', 'ShowRenameDialog', 'RenamingRankingId', 'NewRankingName', 'RankingMode', 'ScoringMode', 'RankingList', 'CurrentRankingId', 'CurrentRankingName', 'ShowHistoryDialog', 'ShowImportDialog', 'ImportedRankingText', 'EditMode', 'EditingItemId', 'EditingItem', 'ShowEditDialog', 'CoverUrl', 'CoverPreview']) {
  model['set' + field] = value => {
    const key = field[0].toLowerCase() + field.slice(1);
    if (deferUpdates) pendingUpdates.push([key, value]);
    else model[key] = value;
  };
}
const context = vm.createContext(model);
vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, context);
const { handlers } = context;
const read = () => JSON.parse(memory.get('yearlyRankings') || '[]');
const results = [];
function check(name, run) { run(); results.push({ name, pass: true }); }

async function main() {
  model.rankingList = [{ id: 'a', rank: 1, title: 'Alpha', artist: 'Tester', coverUrl: 'cover', review: '', originalScore: 90, integrity: 1, durability: 1, finalScore: 10 }];
  check('first save asks for a name', () => {
    handlers.handleSaveClick();
    assert.equal(model.showSaveDialog, true);
    assert.equal(read().length, 0);
  });
  check('named save keeps covers and metadata', () => {
    model.rankingName = '验收榜单';
    handlers.saveRanking();
    const [record] = read();
    assert.equal(record.name, '验收榜单');
    assert.equal(record.rankingList[0].coverUrl, 'cover');
    assert.equal(record.type, '年度专辑榜');
    assert.ok(record.createdAt && record.updatedAt);
  });
  check('load restores the editable identity', () => {
    handlers.loadHistoryRanking(read()[0]);
    assert.equal(model.currentRankingId, read()[0].id);
    assert.equal(model.currentRankingName, '验收榜单');
  });
  check('save loaded ranking updates without duplicating', () => {
    model.rankingList = [{ ...model.rankingList[0], review: 'updated' }];
    handlers.handleSaveClick();
    assert.equal(read().length, 1);
    assert.equal(read()[0].rankingList[0].review, 'updated');
  });
  check('save as creates a separately named record', () => {
    handlers.handleSaveAsClick();
    model.rankingName = '另存为验收';
    handlers.saveRanking();
    assert.equal(read().length, 2);
    assert.equal(read()[1].name, '另存为验收');
  });
  check('rename retains data and other records', () => {
    model.renamingRankingId = read()[0].id;
    model.newRankingName = '重命名验收';
    handlers.renameHistoryRanking();
    assert.equal(read()[0].name, '重命名验收');
    assert.equal(read().length, 2);
    assert.equal(read()[0].rankingList[0].review, 'updated');
  });
  check('import parses score and both bonuses', () => {
    model.rankingList = [];
    model.importedRankingText = 'Alpha - Tester 90+1++1\nBeta - Tester 80+0++0';
    handlers.handleImportRanking();
    assert.equal(model.rankingList.length, 2);
    assert.equal(model.rankingList[0].originalScore, 90);
    assert.equal(model.rankingList[0].integrity, 1);
    assert.equal(model.rankingList[0].durability, 1);
    assert.equal(model.rankingList[0].finalScore, 10);
    assert.equal(model.rankingList[1].finalScore, 0);
  });
  check('manual moves update ranks', () => {
    handlers.moveItemDown(model.rankingList[0]);
    assert.equal(model.rankingList[0].title, 'Beta');
    assert.equal(model.rankingList[0].rank, 1);
    assert.equal(model.rankingList[1].rank, 2);
  });
  model.scoringMode = 'non-scoring';
  model.editMode = true;
  model.editingItemId = model.rankingList[0].id;
  form = { elements: { namedItem: name => ({ value: { title: 'Zeta', artist: 'Tester', review: 'edited', score: '80' }[name] || '' }) }, reset() {} };
  // React batches updates: setter calls do not mutate this render's closures.
  deferUpdates = true;
  await handlers.handleSubmit({ preventDefault() {}, target: form });
  deferUpdates = false;
  for (const [key, value] of pendingUpdates) model[key] = value;
  check('editing non-scoring items keeps manual order and the uploaded cover', () => {
    assert.equal(model.rankingList[0].title, 'Zeta');
    assert.equal(model.rankingList[0].coverUrl, '/artists/images/LG2.jpg');
    assert.equal(model.rankingList[1].title, 'Alpha');
    assert.equal(model.showEditDialog, false);
  });
  fs.mkdirSync('docs/audit', { recursive: true });
  fs.writeFileSync('docs/audit/behavior-verification.json', JSON.stringify({ isolated: true, results }, null, 2) + '\n');
  for (const result of results) console.log('PASS ' + result.name);
}

main().catch(error => { console.error(error); process.exitCode = 1; });

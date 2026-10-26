// Optional live audit against the user's running QQ Music API; no rankings are changed.
const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync('src/app/services/qqMusicService.ts', 'utf8')
  .replace(/import .*?;\s*/, "const QQ_MUSIC_CONFIG = { baseUrl: 'http://localhost:3200' };\n")
  .replace('export const qqMusicService', 'const qqMusicService') + '\nglobalThis.service = qqMusicService;';
const sandbox = { URL, AbortSignal, fetch, setTimeout, localStorage: { getItem: () => null }, console: { log() {}, warn() {}, error() {} } };
vm.createContext(sandbox); vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), sandbox);
const output = {};
vm.runInNewContext(ts.transpile(fs.readFileSync('src/app/utils/rankingImport.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }), { exports: output });
const items = output.parseRankingText(fs.readFileSync('scripts/fixtures/ranking-import-2026.txt', 'utf8')).items;
(async () => {
  let next = 0, completed = 0;
  const results = [];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < items.length) {
      const item = items[next++];
      const cover = await sandbox.service.findCover(item.title, item.artist, '年度专辑榜');
      results.push({ title: item.title, artist: item.artist, cover }); completed++;
      if (completed % 10 === 0 || completed === items.length) console.log(`Processed ${completed}/${items.length}; matched ${results.filter(item => item.cover).length}`);
    }
  }));
  const report = { matched: results.filter(item => item.cover).length, total: items.length, unmatched: results.filter(item => !item.cover), results };
  const file = path.join(os.tmpdir(), 'melorank-covers-audit.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ matched: report.matched, total: report.total, unmatched: report.unmatched, report: file }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });

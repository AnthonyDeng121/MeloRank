const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync('src/app/services/qqMusicService.ts', 'utf8')
  .replace(/import .*?;\s*/, "const QQ_MUSIC_CONFIG = { baseUrl: 'http://api.test' };\n")
  .replace('export const qqMusicService', 'const qqMusicService') + '\nglobalThis.service = qqMusicService;';
const sandbox = { URL, AbortSignal, setTimeout: callback => queueMicrotask(callback), localStorage: { getItem: () => null },
  console: { log() {}, error() {}, warn() {} } };
vm.createContext(sandbox);
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), sandbox);
const service = sandbox.service;
service.getAlbumTracks = async () => { throw new Error('Album lookup unavailable'); };
let calls = 0, resultForCall;
sandbox.fetch = async () => ({ ok: true, json: async () => ({ response: { data: { song: { list: resultForCall(++calls) } } } }) });
const song = (name, artist, mid) => ({ albumname: name, singer: [{ name: artist }], albummid: mid });
(async () => {
  resultForCall = () => [song('MAMIHLAPINATAPAI', 'Someone Else', 'wrong'), song('MAMIHLAPINATAPAI', 'ILLIT (아일릿)', 'correct')];
  assert.match(await service.findCover('MAMIHLAPINATAPA', 'ILLIT', '年度专辑榜'), /M000correct\.jpg$/);
  assert.equal(calls, 1);
  console.log('PASS reported ILLIT case: one-character typo and artist alias, with wrong artist rejected');
  const cases = [
    ['AFTER CRY', 'Baby DONT Cry', 'The 1st Mini Album [AFTER CRY]', 'Baby DONT Cry'],
    ['Glow', 'XngHan&Xoul', 'Glow - The 1st Mini Album', 'XngHan&Xoul'],
    ['Mutualism', 'MRCH', '상생관계 (mutualism)', '윤마치 (MRCH)'],
    ['4th', '金惠林', '4th', '김혜림 (金惠林)'],
    ['GOODIES', 'Y:SY', 'GOODIES', '이서연 (Y:SY) (李瑞渊)'],
    ['Atmos', 'SHINEee', 'Atmos - The 6th Mini Album', 'SHINee (샤이니)'],
    ['ALL THE COLORS I AM', '柳洙正', 'Ryu Sujeong 4th EP [ALL THE COLORS I AM]', '柳洙正 (류수정)'],
    ['FIRESTARTER', 'K/DA', 'FIRESTARTER (燃)', 'K/DA;英雄联盟;i-dle'],
    ['PUZZ (OV) E', '郑大贤', 'PUZZL (OV) E', '郑大贤 (정대현)'],
  ];
  for (const [title, artist, album, singer] of cases) {
    calls = 0; resultForCall = () => [song(album, singer, 'metadata-match')];
    assert.match(await service.findCover(title, artist, '年度专辑榜'), /M000metadata-match\.jpg$/, title);
  }
  console.log('PASS album descriptors, bilingual aliases, translations, artist typos and the supplied PUZZ typo');
  calls = 0;
  resultForCall = () => [song('Long Album NamE!', 'Artist', 'fuzzy'), song('Long Album Name', 'Artist', 'exact')];
  assert.match(await service.findCover('Long Album Name', 'Artist', '年度专辑榜'), /M000exact\.jpg$/);
  calls = 0;
  resultForCall = () => [song('GOLDEN HOUR : Part.5', 'ATEEZ', 'wrong-part')];
  assert.equal(await service.findCover('GOLDEN HOUR : Part.4', 'ATEEZ', '年度专辑榜'), '');
  assert.equal(calls, 3);
  console.log('PASS exact title preferred; numbered album parts cannot fuzzy-match each other; retries bounded to three');
  calls = 0;
  resultForCall = count => count === 1 ? [] : [song('Retry Album', 'Artist', 'retry-success')];
  assert.match(await service.findCover('Retry Album', 'Artist', '年度专辑榜'), /M000retry-success\.jpg$/);
  assert.equal(calls, 2);
  console.log('PASS empty results do not block retry with negative cache');
  calls = 0;
  resultForCall = count => [song(count === 1 ? 'Different Album' : 'Fresh Album', 'Artist', count === 1 ? 'stale' : 'fresh')];
  assert.match(await service.findCover('Fresh Album', 'Artist', '年度专辑榜'), /M000fresh\.jpg$/);
  assert.equal(calls, 2);
  console.log('PASS retries bypass previously cached non-matching search responses');
})().catch(error => { console.error(error); process.exitCode = 1; });

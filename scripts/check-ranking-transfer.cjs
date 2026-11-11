const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const exportsObject = {};
let found = [], albumTracks = [], albumCalls = 0;
const modules = {
  './musicPlatforms': { netease: {} }, './qqMusicConfig': { QQ_MUSIC_CONFIG: { baseUrl: 'fixture' } },
  './platformSongs': { searchPlatform: async () => ({ response: { data: { song: { list: found } } } }), platformAlbumTracks: async (_, title, artist, cover) => { albumCalls++; assert.equal(cover, ''); return albumTracks; } },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/services/playlistTransfer.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, require: name => modules[name], AbortSignal });
const { matchRankingEntry, appendRankingTracks } = exportsObject;
const song = (provider, id, name = 'Song') => ({ provider, providerId: id, songmid: id, songname: name, singer: [{ name: 'Artist' }], albumname: 'Album' });
async function check(provider) {
  const entry = { id: 'ranking-1', title: 'Song', artist: 'Artist', coverUrl: 'https://unrelated.example/image.jpg' };
  found = [song(provider, 'wrong', 'Unrelated'), { ...song(provider, 'wrong-artist'), singer: [{ name: 'Other' }] }, song(provider, 'right')];
  assert.equal((await matchRankingEntry(provider, entry, false)).song.songmid, 'right');
  found = [song(provider, 'wrong', 'Live Song')]; assert.ok((await matchRankingEntry(provider, entry, false)).error);
  albumTracks = [song(provider, 'first'), { ...song(provider, 'second'), popularity: 9999 }];
  assert.equal((await matchRankingEntry(provider, { ...entry, title: 'Album' }, true)).song.songmid, 'first');
  assert.ok(albumCalls);
  let ids = ['existing'], writes = [], failAt = 0, ignoreSort = false;
  const adapters = { read: async () => [...ids], write: async (_, body) => {
    writes.push(body);
    if (failAt && writes.length === failAt) throw Error('fixture conflict');
    if (body.action === 'add') ids = [body.trackId, ...ids];
    else if (!ignoreSort) ids = [...body.ids];
    return { ids: [...ids] };
  } };
  const result = await appendRankingTracks(provider, 'target', [song(provider, '2'), song(provider, '1'), song(provider, '2')], () => {}, adapters);
  assert.equal(result.added, 2); assert.equal(result.skipped, 1); assert.deepEqual(ids, ['existing', '2', '1']);
  assert.equal(writes.filter(body => body.action === 'add').length, 2); assert.equal(writes.at(-1).action, 'reorder');
  assert.ok(writes.every(body => body.action !== 'remove'));
  ids = ['existing']; writes = []; failAt = 2;
  await assert.rejects(() => appendRankingTracks(provider, 'target', [song(provider, '2'), song(provider, '1')], () => {}, adapters), /已确认添加 1 首/);
  assert.deepEqual(ids, ['2', 'existing']); assert.equal(writes.length, 2);
  ids = ['existing']; writes = []; failAt = 0; ignoreSort = true;
  await assert.rejects(() => appendRankingTracks(provider, 'target', [song(provider, '2')], () => {}, adapters), /最终顺序/);
  const before = writes.length;
  await assert.rejects(() => appendRankingTracks(provider, 'target', [song(provider === 'qq' ? 'netease' : 'qq', '3')], () => {}, adapters), /目标平台/);
  assert.equal(writes.length, before);
  console.log(`PASS ${provider}: exact title/artist matching, album first-track fallback, deduplication, preserve existing tracks, final order, partial failure`);
}
(async () => { await check('qq'); await check('netease'); })().catch(error => { console.error(error); process.exitCode = 1; });

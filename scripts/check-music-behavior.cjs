const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const nickname = require('../qq-music-api-main/util/qrNickname');

assert.equal(nickname("ptuiCB('0','0','https://qq.com','0','登录成功','小明');"), '小明');
assert.equal(nickname(String.raw`ptuiCB('0','0','https://qq.com','0','ok','Melo\'s \\ music');`), "Melo's \\ music");
assert.equal(nickname(String.raw`ptuiCB('0','0','url','0','ok','\u5c0f\u660e');`), '小明');
assert.equal(nickname("ptuiCB('66','0','','0','等待扫码');"), '');
console.log('PASS QR nickname parses Chinese, escaped characters, and pending login');

const source = fs.readFileSync('src/app/services/qqMusicService.ts', 'utf8')
  .replace(/import .*?;\s*/, "const QQ_MUSIC_CONFIG = { baseUrl: 'http://api.test' };\n")
  .replace('export const qqMusicService', 'const qqMusicService') + '\nglobalThis.service = qqMusicService;';
const sandbox = { URL, localStorage: { getItem: () => null }, console: { log() {}, warn() {}, error() {} } };
vm.createContext(sandbox);
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), sandbox);
const service = sandbox.service;

(async () => {
  let albumRequests = 0;
  let expectedMid = 'correct-album';
  sandbox.fetch = async url => {
    const request = new URL(url);
    if (request.pathname === '/getSearchByKey') return { ok: true, json: async () => ({ response: { data: { album: { list: [] } } } }) };
    if (request.pathname === '/getSmartbox') return { ok: true, json: async () => ({ response: { data: { singer: { itemlist: [{ name: 'Kesha', mid: 'artist-mid' }] } } } }) };
    if (request.pathname === '/getSingerAlbum') return { ok: true, json: async () => ({ response: { singer: { data: { albumList: [
      { albumName: 'Animal', albumMid: 'wrong-album' },
      { albumName: '. (...) [Explicit]', albumMid: 'deluxe-album' },
      { albumName: '. (Explicit)', albumMid: 'correct-album' }
    ] } } } }) };
    assert.equal(request.pathname, '/getAlbumInfo');
    assert.equal(request.searchParams.get('albummid'), expectedMid);
    albumRequests++;
    return { ok: true, json: async () => ({ response: { data: { total_song_num: 2, list: [
      { songmid: 'second', songname: 'JOYRIDE.', cdIdx: 0, belongCD: 2 },
      { songmid: 'first', songname: 'FREEDOM.', cdIdx: 0, belongCD: 1 }
    ] } } }) };
  };
  const songs = await service.getAlbumTracks('.', 'Kesha', 'data:image/webp;base64,test');
  assert.equal(songs.length, 2);
  assert.equal(songs[0].songmid, 'first');
  assert.equal(songs[1].albumname, '.');
  console.log('PASS punctuation album resolves exact artist album, rejects deluxe and sorts track order');
  expectedMid = 'correctalbum';
  await service.getAlbumTracks('.', 'Kesha', 'https://y.qq.com/music/photo_new/T002R300x300M000correctalbum.jpg');
  assert.equal(albumRequests, 2);
  console.log('PASS QQ album cover uses album identity directly');
  await assert.rejects(service.getAlbumTracks('Missing album', 'Kesha'), /未找到匹配的专辑/);
  assert.equal(albumRequests, 2);
  console.log('PASS unmatched albums never fall back to artist hits');
})().catch(error => { console.error(error); process.exitCode = 1; });

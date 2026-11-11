const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const { createMusicPlatformsRouter } = require('../backend/src/musicPlatforms');
const { createPlaylistEdit } = require('../qq-music-api-main/routers/context/playlistEdit');
const { requestAuth } = require('../qq-music-api-main/util/requestAuth');

async function netease() {
  const state = { name: 'Original', creator: { userId: 7 }, trackIds: [{ id: 1 }], trackCount: 1, coverImgId: 10, coverImgUrl: 'https://p1.music.126.net/old.jpg', description: 'Keep me', tags: ['Keep tag'] };
  let source = 'http://p1.music.126.net/album.jpg', downloads = 0, acceptName = true;
  const api = {
    login_status: async () => ({ body: { data: { profile: { userId: 7 } } } }),
    playlist_detail: async () => ({ body: { playlist: structuredClone(state) } }),
    playlist_name_update: async params => { if (acceptName) state.name = params.name; return { body: { code: 200 } }; },
    song_detail: async () => ({ body: { songs: [{ id: 1, al: { picUrl: source } }] } }),
    playlist_cover_update: async params => {
      assert.ok(Buffer.isBuffer(params.imgFile.data)); assert.ok([4, 8].includes(params.imgFile.size));
      state.coverImgId = 20; state.coverImgUrl = 'https://p1.music.126.net/new.jpg';
      return { body: { code: 200, data: { imgId: 20 } } };
    },
  };
  const coverFetch = async (url, options) => { downloads++; assert.equal(url, 'https://p1.music.126.net/album.jpg'); assert.equal(options.redirect, 'error'); return { ok: true, headers: new Headers({ 'content-type': 'image/jpeg', 'content-length': '4' }), arrayBuffer: async () => Uint8Array.from([255, 216, 255, 217]).buffer }; };
  const app = express(); app.use(express.json()); app.use(createMusicPlatformsRouter(() => api, undefined, coverFetch));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const request = (body = {}, cookie = 'fixture') => fetch(`http://127.0.0.1:${server.address().port}/playlist/edit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': cookie }, body: JSON.stringify({ action: 'metadata', id: '9', baseIds: ['1'], name: state.name, baseName: state.name, ...body }) });
  try {
    assert.equal((await request({}, '')).status, 401);
    state.creator.userId = 8; assert.equal((await request()).status, 403); state.creator.userId = 7;
    assert.equal((await request({ baseName: 'Stale' })).status, 409);
    assert.equal((await request({ name: ' ' })).status, 400);
    assert.equal((await request({ coverTrackId: '2' })).status, 400);
    const renamed = await (await request({ name: 'Renamed' })).json(); assert.equal(renamed.metadata.title, 'Renamed');
    const covered = await (await request({ coverTrackId: '1' })).json(); assert.equal(covered.metadata.image, state.coverImgUrl); assert.equal(downloads, 1);
    assert.equal((await request({ coverData: 'data:image/jpeg;base64,/9j/AAECAwQ=' })).status, 200);
    assert.equal(downloads, 1, 'local upload does not download an external picture');
    assert.equal((await request({ coverData: 'data:image/jpeg;base64,aGVsbG8=' })).status, 400);
    assert.equal(state.description, 'Keep me'); assert.deepEqual(state.tags, ['Keep tag']);
    source = 'http://127.0.0.1/private'; assert.equal((await request({ coverTrackId: '1' })).status, 502); assert.equal(downloads, 1);
    acceptName = false; assert.equal((await request({ name: 'Not accepted' })).status, 409);
    console.log('PASS 网易云：改名、受控封面上传、归属和旧名称冲突、保留描述标签、读回失败');
  } finally { server.close(); }
}

async function qq() {
  const state = { id: 9, dirid: 1, owndir: 1, title: 'Original', desc: 'Keep description', picurl: 'https://y.qq.com/old.jpg', picurl2: 'https://y.qq.com/old2.jpg', vec_tagid: [3, 7], dir_show: 2 };
  let writes = 0, accept = true;
  const rpc = async (_, module, method, params) => {
    if (method === 'PutImage') {
      assert.equal(module, 'music.filesys.FileSystem'); assert.equal(params.BusID, 'songlist');
      assert.equal(params.Data, 'data:image/jpeg;base64,/9j/AAECAwQ='); assert.match(params.FileName, /^7_\d+\.jpg$/);
      return { URL: 'https://y.gtimg.cn/local-cover.jpg' };
    }
    if (method === 'CgiGetDiss') return { dirinfo: state, total_song_num: 1, songlist: [{ mid: 'm1', id: 1, type: 0, album: { mid: 'album1' } }] };
    if (method === 'uniform_get_Dissinfo') return { dirinfo: structuredClone(state) };
    assert.equal(method, 'EditPlaylist'); assert.equal(params.mask, 95); assert.equal(params.dirId, 1);
    assert.equal(params.dirNewDesc, 'Keep description'); assert.equal(params.dirNewtaglist, '3,7'); assert.equal(params.dirShow, 2);
    writes++;
    if (accept) Object.assign(state, { title: params.dirNewName, picurl: params.dirNewPicUrl, picurl2: params.dirNewPicUrl2 });
    return { retCode: 0 };
  };
  const handler = createPlaylistEdit({ rpc, get: async () => ({ data: { code: 0, data: { disslist: [{ tid: 9, dirid: 1 }] } } }) });
  const request = async (body = {}) => { const ctx = { request: { body: { action: 'metadata', id: '9', baseIds: ['m1'], baseName: state.title, name: state.title, ...body } }, status: 200, set() {} }; await requestAuth.run({ cookie: 'uin=7; qm_keyst=fixture' }, () => handler(ctx)); return ctx; };
  assert.equal((await request({ name: 'Renamed' })).body.metadata.title, 'Renamed');
  assert.equal(state.picurl2, 'https://y.qq.com/old2.jpg');
  assert.equal((await request({ coverTrackId: 'm1' })).status, 200); assert.match(state.picurl, /T002R300x300M000album1\.jpg$/);
  assert.equal((await request({ baseName: 'Original' })).status, 409);
  assert.equal((await request({ name: 'x'.repeat(21) })).status, 400);
  assert.equal((await request({ coverTrackId: 'other' })).status, 400);
  delete state.vec_tagid; assert.equal((await request()).status, 502); state.vec_tagid = [3, 7];
  assert.equal(writes, 2, 'invalid edits must not write');
  assert.equal((await request({ coverData: 'data:image/jpeg;base64,/9j/AAECAwQ=' })).status, 200);
  assert.equal(state.picurl, 'https://y.gtimg.cn/local-cover.jpg');
  assert.equal((await request({ coverData: 'data:text/html;base64,aGVsbG8=' })).status, 400);
  accept = false; assert.equal((await request({ name: 'Not accepted' })).status, 409);
  console.log('PASS QQ：mask95 资料编辑、专辑封面、名称校验、保留隐私描述标签、缺失字段拒绝和读回失败');
}
(async () => { await netease(); await qq(); })().catch(error => { console.error(error); process.exitCode = 1; });

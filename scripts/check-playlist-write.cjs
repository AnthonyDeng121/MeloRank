const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const { createMusicPlatformsRouter } = require('../backend/src/musicPlatforms');
const { createPlaylistEdit } = require('../qq-music-api-main/routers/context/playlistEdit');
const { requestAuth } = require('../qq-music-api-main/util/requestAuth');

async function checkNetease() {
  let ids = ['1', '2'], owner = 7, writes = 0, accepted = true, mutate = true, pause;
  const api = {
    login_status: async () => ({ body: { data: { profile: { userId: 7 } } } }),
    playlist_detail: async () => ({ body: { playlist: { creator: { userId: owner }, specialType: 0, trackIds: ids.map(id => ({ id })), trackCount: ids.length } } }),
    playlist_tracks: async params => {
      writes++; if (pause) await pause;
      if (accepted && mutate) ids = params.op === 'add' ? [...ids, params.tracks] : ids.filter(id => id !== params.tracks);
      return { body: { body: { code: accepted ? 200 : 502 } } };
    },
    song_order_update: async params => { writes++; ids = JSON.parse(params.ids); return { body: { code: 200 } }; },
  };
  const app = express(); app.use(express.json()); app.use(createMusicPlatformsRouter(() => api));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (body, cookie = 'fixture') => fetch(`http://127.0.0.1:${server.address().port}/playlist/edit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': cookie }, body: JSON.stringify({ id: '9', action: 'add', trackId: '3', baseIds: [...ids], ...body }) });
  try {
    assert.equal((await request({}, '')).status, 401);
    owner = 8; assert.equal((await request({})).status, 403); owner = 7;
    assert.equal((await request({ baseIds: ['1'] })).status, 409);
    assert.equal((await request({ id: '../9' })).status, 400);
    assert.equal(writes, 0);
    assert.equal((await request({})).status, 200); assert.deepEqual(ids, ['1', '2', '3']);
    assert.equal((await request({})).status, 200); assert.equal(writes, 1, 'duplicate add is idempotent');
    assert.equal((await request({ action: 'reorder', ids: ['3', '2', '1'] })).status, 200); assert.deepEqual(ids, ['3', '2', '1']);
    assert.equal((await request({ action: 'reorder', ids: ['1', '2'] })).status, 400);
    assert.equal((await request({ action: 'remove', trackId: '2' })).status, 200); assert.deepEqual(ids, ['3', '1']);
    accepted = false; assert.equal((await request({ trackId: '4' })).status, 502); accepted = true;
    mutate = false; assert.equal((await request({ trackId: '4' })).status, 409); mutate = true;
    let release; pause = new Promise(resolve => { release = resolve; });
    const previous = writes, first = request({ trackId: '5' });
    while (writes === previous) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await request({ trackId: '6' })).status, 409);
    release(); assert.equal((await first).status, 200); pause = undefined;
    assert.equal((await request({ trackId: '6' })).status, 200, 'lock released');
    console.log('PASS 网易云：归属、快照冲突、增删、完整排序、幂等、并发锁、业务失败和读回校验');
  } finally { server.close(); }
}

async function checkQQ() {
  let ids = ['m1', 'm2'], writes = 0, owner = true, accepted = true, mutate = true, pause;
  const calls = [];
  const rpc = async (cookie, module, method, params) => {
    calls.push({ cookie, module, method, params });
    if (method === 'CgiGetDiss') return { dirinfo: { id: 9, dirid: 1, owndir: owner ? 1 : 0 }, songlist: ids.map(mid => ({ mid, id: Number(mid.slice(1)), type: 0 })), total_song_num: ids.length };
    if (method === 'get_song_detail_yqq') return { track_info: { mid: params.song_mid, id: Number(params.song_mid.slice(1)), type: 0 } };
    writes++; if (pause) await pause;
    if (!accepted) throw Object.assign(new Error('平台拒绝'), { status: 502 });
    assert.equal(params.dirId, 1);
    if (method === 'SeqSonglist') {
      assert.equal(params.tid, 9);
      assert.deepEqual(params.v_songPair.map(song => song.songType), ids.map(() => 0));
      if (mutate) ids = params.v_songPair.map(song => `m${song.songId}`);
      return { retCode: 0 };
    }
    const mid = `m${params.v_songInfo[0].songId}`;
    if (mutate) ids = method === 'AddSonglist' ? [...ids, mid] : ids.filter(id => id !== mid);
    return { retCode: 0 };
  };
  const handler = createPlaylistEdit({ rpc, get: async () => ({ data: { code: 0, data: { disslist: [{ tid: 9, dirid: 1 }] } } }) });
  const request = async (body = {}, cookie = 'uin=7; qm_keyst=fixture') => {
    const ctx = { request: { body: { id: '9', action: 'add', trackId: 'm3', baseIds: [...ids], ...body } }, status: 200, set() {} };
    await requestAuth.run({ cookie }, () => handler(ctx)); return ctx;
  };
  assert.equal((await request({}, '')).status, 401);
  owner = false; assert.equal((await request()).status, 403); owner = true;
  assert.equal((await request({ baseIds: ['m1'] })).status, 409);
  assert.equal((await request({ action: 'reorder' })).status, 400);
  assert.equal(writes, 0);
  assert.equal((await request()).status, 200); assert.deepEqual(ids, ['m1', 'm2', 'm3']);
  assert.equal(calls.at(-2).cookie, 'uin=7; qm_keyst=fixture');
  assert.equal((await request()).status, 200); assert.equal(writes, 1);
  assert.equal((await request({ action: 'remove', trackId: 'm2' })).status, 200); assert.deepEqual(ids, ['m1', 'm3']);
  accepted = false; assert.equal((await request({ trackId: 'm4' })).status, 502); accepted = true;
  mutate = false; assert.equal((await request({ trackId: 'm4' })).status, 409); mutate = true;
  assert.equal((await request({ trackId: 'm4' })).status, 200);
  const beforeSort = writes;
  assert.equal((await request({ action: 'reorder', ids: ['m4', 'm1'] })).status, 400);
  assert.equal((await request({ action: 'reorder', ids: ['m4', 'm1', 'm1'] })).status, 400);
  assert.equal((await request({ action: 'reorder', ids: ['m4', 'm1', 'm8'] })).status, 400);
  assert.equal((await request({ action: 'reorder', ids: ['m4', 'm1', 'm3'], baseIds: ['m4', 'm1', 'm3'] })).status, 409);
  assert.equal(writes, beforeSort, 'invalid or stale ordering never writes');
  assert.equal((await request({ action: 'reorder', ids: ['m4', 'm1', 'm3'] })).status, 200);
  assert.deepEqual(ids, ['m4', 'm1', 'm3']);
  const sort = calls.find(call => call.method === 'SeqSonglist');
  assert.deepEqual(sort.params, { dirId: 1, tid: 9, v_songPair: [{ songId: 4, songType: 0 }, { songId: 1, songType: 0 }, { songId: 3, songType: 0 }] });
  assert.equal((await request({ action: 'reorder', ids: [...ids] })).status, 200);
  assert.equal(writes, beforeSort + 1, 'unchanged order is idempotent');
  mutate = false;
  assert.equal((await request({ action: 'reorder', ids: [...ids].reverse() })).status, 409, 'same members in wrong order must fail verification');
  mutate = true;
  let release; pause = new Promise(resolve => { release = resolve; });
  const previous = writes, first = request({ action: 'reorder', ids: [...ids].reverse() });
  while (writes === previous) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await request({ action: 'reorder', ids: [...ids].reverse() })).status, 409);
  release(); assert.equal((await first).status, 200); pause = undefined;
  console.log('PASS QQ：归属、增删、SeqSonglist 精确参数、完整排序、旧顺序冲突、幂等、并发锁及顺序读回校验');
}

async function checkQQOrderedRead() {
  const rpcModule = require('../qq-music-api-main/util/playlistRpc');
  const original = rpcModule.playlistRpc;
  const handler = require('../qq-music-api-main/routers/context/userLibrary');
  const seen = [];
  rpcModule.playlistRpc = async (cookie, module, method, params) => {
    seen.push(params);
    assert.equal(cookie, 'uin=7; qm_keyst=fixture');
    assert.equal(method, 'CgiGetDiss');
    return { songlist: [{ mid: 'm3', title: 'Third' }, { mid: 'm1', title: 'First' }], total_song_num: 32 };
  };
  try {
    const ctx = { query: { kind: 'collection', type: 'playlists', id: '9', offset: '30' }, set() {} };
    await requestAuth.run({ cookie: 'uin=7; qm_keyst=fixture' }, () => handler(ctx));
    assert.deepEqual(ctx.body.items.map(item => item.id), ['m3', 'm1']);
    assert.equal(ctx.body.hasMore, false);
    assert.deepEqual(seen[0], { disstid: 9, dirid: 0, tag: true, userinfo: true, orderlist: true, song_begin: 30, song_num: 30 });
    console.log('PASS QQ：详情分页使用相同有序读取协议，保留平台返回顺序');
  } finally { rpcModule.playlistRpc = original; }
}

async function checkQQLoginError() {
  const axios = require('../qq-music-api-main/node_modules/axios');
  const original = axios.post;
  const key = [122, 63, 140, 29, 94, 155, 47, 10, 108, 77, 126, 139, 31, 58, 92, 157, 14, 43, 111, 74, 129];
  const encode = object => Buffer.from(JSON.stringify(object)).map((value, index) => value ^ key[index % key.length]);
  let code = 1000;
  axios.post = async () => ({ data: encode({ code: 0, req: { code, data: { retCode: 0 } } }) });
  try {
    const { playlistRpc } = require('../qq-music-api-main/util/playlistRpc');
    await assert.rejects(() => playlistRpc('fixture', 'fixture', 'fixture', {}), error => error.status === 401);
    code = 2000;
    await assert.rejects(() => playlistRpc('fixture', 'fixture', 'fixture', {}), error => error.status === 502);
    console.log('PASS QQ：登录失效返回 401，签名错误不误判为登录失效');
  } finally { axios.post = original; }
}

(async () => { await checkNetease(); await checkQQ(); await checkQQOrderedRead(); await checkQQLoginError(); })().catch(error => { console.error(error); process.exitCode = 1; });

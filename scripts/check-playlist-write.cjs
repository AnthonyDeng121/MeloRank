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
  let ids = ['m1', 'm2'], writes = 0, owner = true, accepted = true, mutate = true;
  const calls = [];
  const rpc = async (cookie, module, method, params) => {
    calls.push({ cookie, module, method, params });
    if (method === 'CgiGetDiss') return { dirinfo: { id: 9, dirid: 1, owndir: owner ? 1 : 0 }, songlist: ids.map(mid => ({ mid, id: Number(mid.slice(1)), type: 0 })), total_song_num: ids.length };
    if (method === 'get_song_detail_yqq') return { track_info: { mid: params.song_mid, id: Number(params.song_mid.slice(1)), type: 0 } };
    writes++;
    if (!accepted) throw Object.assign(new Error('平台拒绝'), { status: 502 });
    assert.equal(params.dirId, 1);
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
  console.log('PASS QQ：账号隔离、归属、快照冲突、歌曲类型核实、增删、幂等和读回校验');
}

(async () => { await checkNetease(); await checkQQ(); })().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const { createMusicPlatformsRouter } = require('../backend/src/musicPlatforms');
const calls = [];
const api = Object.fromEntries(['login_status','user_playlist','album_sublist','album','playlist_track_all','login_qr_key','login_qr_create','login_qr_check','logout'].map(name => [name, async params => {
  calls.push({ name, params });
  const results = {
    login_status: { data: { profile: { userId: 7, nickname: 'fixture' } } },
    user_playlist: { playlist: [{ id: 1, name: '我喜欢的音乐', specialType: 5, creator: { userId: 7 }, trackCount: 1 }, { id: 2, name: 'Mine', creator: { userId: 7 } }, { id: 3, name: 'Other', creator: { userId: 8 } }], more: false },
    album_sublist: { data: [{ id: 4, name: 'Album', artists: [{ name: 'Artist' }] }], count: 1 },
    playlist_track_all: { songs: [{ id: 5, name: 'Song', ar: [{ name: 'Artist' }] }] },
    album: { songs: [{ id: 6, name: 'Album song', artists: [{ name: 'Artist' }] }] },
    login_qr_key: { data: { unikey: 'fixture-qr-key' } }, login_qr_create: { data: { qrimg: 'data:image/png;base64,fixture' } },
    login_qr_check: { code: 803, cookie: 'MUSIC_U=fixture' }, logout: { code: 200 },
  };
  return { status: 200, body: results[name] };
}]));
const app = express(); app.use(express.json()); app.use('/api', createMusicPlatformsRouter(() => api));
const server = app.listen(0, '127.0.0.1', async () => {
  try {
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = (path, body, cookie = 'MUSIC_U=fixture') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': cookie }, body: JSON.stringify(body) });
    assert.equal((await request('/library', { kind: 'liked' }, '')).status, 401);
    assert.equal(calls.length, 0);
    const list = await (await request('/library', { kind: 'playlists' })).json();
    assert.deepEqual(list.items.map(i => i.title), ['Mine']);
    const songs = await (await request('/library', { kind: 'liked' })).json();
    assert.equal(songs.items[0].title, 'Song');
    assert.equal(songs.hasMore, false);
    assert.equal((await (await request('/library', { kind: 'albums' })).json()).items[0].title, 'Album');
    assert.equal((await request('/library', { kind: 'unknown' })).status, 400);
    assert.equal((await request('/collection', { kind: 'albums', id: '4' }, '')).status, 401);
    assert.equal((await request('/collection', { kind: 'albums', id: '../invalid' })).status, 400);
    const collection = await (await request('/collection', { kind: 'playlists', id: '2', offset: 30 })).json();
    assert.equal(collection.items[0].title, 'Song');
    assert.equal(calls.at(-1).params.offset, 30);
    const album = await (await request('/collection', { kind: 'albums', id: '4' })).json();
    assert.equal(album.items[0].subtitle, 'Artist');
    const qr = await (await request('/qr', {})).json(); assert.equal(qr.key, 'fixture-qr-key');
    assert.equal(calls.find(call => call.name === 'login_qr_key').params.timeout, 7000);
    const createParams = calls.find(call => call.name === 'login_qr_create').params;
    assert.equal(createParams.platform, 'web');
    assert.equal(createParams.ua, 'pc');
    // Exercise the installed SDK too: a mocked image alone cannot catch QR URL regressions.
    const createQr = require('../backend/node_modules/@neteasecloudmusicapienhanced/api/module/login_qr_create');
    const actualQr = await createQr(createParams);
    const qrUrl = new URL(actualQr.body.data.qrurl);
    assert.equal(qrUrl.origin, 'https://music.163.com');
    assert.equal(qrUrl.searchParams.get('codekey'), qr.key);
    assert.match(qrUrl.searchParams.get('chainId'), /^v1_.+_web_login_\d+$/);
    assert.match(actualQr.body.data.qrimg, /^data:image\/png;base64,/);
    const originalKey = api.login_qr_key;
    let attempts = 0;
    api.login_qr_key = async params => {
      if (++attempts === 1) throw { status: 502, body: { msg: 'timeout of 7000ms exceeded' } };
      return originalKey(params);
    };
    assert.equal((await request('/qr', {})).status, 200);
    assert.equal(attempts, 2, 'Transient SDK failures should retry once');
    api.login_qr_key = async () => { throw { status: 502, body: { msg: 'timeout of 7000ms exceeded' } }; };
    const failedQr = await request('/qr', {});
    assert.equal(failedQr.status, 502);
    assert.match((await failedQr.json()).error, /超时/);
    api.login_qr_key = originalKey;
    assert.equal((await request('/qr/check', { key: 'bad' })).status, 400);
    const login = await (await request('/qr/check', { key: qr.key })).json(); assert.equal(login.code, 803); assert.equal(login.profile.userId, 7);
    assert.equal(calls.find(call => call.name === 'login_qr_check').params.ua, 'pc');
    api.login_qr_check = async () => ({ status: 200, body: {} });
    assert.equal((await request('/qr/check', { key: qr.key })).status, 502);
    console.log('PASS library authentication, own playlist filtering, liked songs/albums and QR contracts');
  } catch (error) { console.error(error); process.exitCode = 1; } finally { server.close(); }
});

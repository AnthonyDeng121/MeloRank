const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const { createMusicPlatformsRouter } = require('../backend/src/musicPlatforms');
const calls = [];
const api = Object.fromEntries(['login_status','user_playlist','album_sublist','album','playlist_track_all','cloudsearch','song_url','lyric','logout'].map(name => [name, async params => {
  calls.push({ name, params });
  const results = {
    login_status: { data: { profile: { userId: 7, nickname: 'fixture' } } },
    user_playlist: { playlist: [{ id: 1, name: '我喜欢的音乐', specialType: 5, creator: { userId: 7 }, trackCount: 1 }, { id: 2, name: 'Mine', creator: { userId: 7 } }, { id: 3, name: 'Other', creator: { userId: 8 } }], more: false },
    album_sublist: { data: [{ id: 4, name: 'Album', artists: [{ name: 'Artist' }] }], count: 1 },
    playlist_track_all: { songs: [{ id: 5, name: 'Song', ar: [{ name: 'Artist' }] }] },
    album: { songs: [{ id: 6, name: 'Album song', artists: [{ name: 'Artist' }] }] },
    cloudsearch: { result: { songs: [{ id: 5, name: 'Song' }], songCount: 1 } }, song_url: { data: [{ id: 5, url: 'http://music.126.net/fixture.mp3' }] }, lyric: { lrc: { lyric: '[00:01]fixture' } }, logout: { code: 200 },
  };
  return { status: 200, body: results[name] };
}]));
const app = express(); app.use(express.json()); app.use('/api', createMusicPlatformsRouter(() => api, async url => ({ ok: true, json: async () => url.endsWith('/check') ? { code: 803, cookie: 'MUSIC_U=fixture' } : { key: 'fixture-go-session', image: 'data:image/png;base64,fixture' } })));
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
    assert.equal(collection.items[0].neteaseTrack.id, 5);
    assert.equal((await request('/search', { query: 'test' }, '')).status, 401);
    assert.equal((await request('/playback', { id: '../bad' })).status, 400);
    const search = await (await request('/search', { query: 'test', limit: 10, offset: 20 })).json();
    assert.equal(search.songs[0].id, 5);
    assert.equal(calls.at(-1).params.cookie, 'MUSIC_U=fixture');
    assert.equal(calls.at(-1).params.offset, 20);
    const playable = await (await request('/playback', { id: '5' })).json();
    assert.equal(playable.url, 'https://music.126.net/fixture.mp3');
    assert.equal(playable.isPreview, false);
    api.song_url = async () => ({ body: { data: [{ id: 5, url: null }] } });
    assert.equal((await request('/playback', { id: '5' })).status, 502);
    assert.equal((await (await request('/lyric', { id: '5' })).json()).lyric, '[00:01]fixture');
    const qr = await (await request('/go/qr', {})).json();
    const login = await (await request('/go/qr/check', { key: qr.key })).json();
    assert.equal(login.profile.userId, 7);
    assert.equal((await request('/qr', {})).status, 404);
    assert.equal((await request('/phone/code', {})).status, 404);
    console.log('PASS library authentication, own playlist filtering, liked songs/albums and QR contracts');
  } catch (error) { console.error(error); process.exitCode = 1; } finally { server.close(); }
});

const express = require('express');

function createMusicPlatformsRouter(getApi = () => require('@neteasecloudmusicapienhanced/api'), goFetch = fetch, coverFetch = fetch) {
  const router = express.Router();
  // Load the SDK during server startup, before accepting requests. Its entry point
  // synchronously loads all API modules; deferring this blocks the first QR request.
  const api = getApi();
  const call = async (name, params) => {
    let response;
    try { response = await api[name]({ timeout: 10000, ...params, timestamp: Date.now() }); }
    catch (error) {
      if ([301, 401].includes(error.body?.code)) throw Object.assign(new Error('网易云登录已失效，请重新登录'), { status: 401 });
      if ([8821, 415, 405].includes(error.body?.code)) throw Object.assign(new Error('网易云要求在官网完成安全验证，请使用官网登录方式'), { status: 403 });
      // The SDK rejects with { status, body }, rather than an Error instance.
      throw Object.assign(new Error(error.body?.msg || error.body?.message || error.message || '网易云接口暂不可用'), { status: 502 });
    }
    const body = response.body || {};
    if ([8821, 415, 405].includes(body.code)) throw Object.assign(new Error('网易云要求在官网完成安全验证，请使用官网登录方式'), { status: 403 });
    if ((response.status || 200) >= 400 || (body.code && ![200, 800, 801, 802, 803].includes(body.code))) throw Object.assign(new Error(body.msg || body.message || '网易云接口请求失败'), { status: body.code === 301 ? 401 : 502 });
    return body;
  };
  const wrap = handler => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await handler(req, res); } catch (error) { res.status(error.status || 502).json({ error: error.status === 401 ? '登录已失效，请重新扫码' : /timeout|timed out|ECONN|ENOTFOUND|EAI_AGAIN|socket/i.test(error.message) ? '网易云接口连接超时，请点击重试' : error.message || '网易云接口暂不可用' }); }
  };
  const auth = req => {
    const cookie = req.get('X-Netease-Cookie') || '';
    if (!cookie) throw Object.assign(new Error('请先登录网易云音乐'), { status: 401 });
    return cookie;
  };
  const profile = async cookie => {
    const response = await call('login_status', { cookie });
    const user = response.data?.profile || response.profile;
    if (!user?.userId) throw Object.assign(new Error('登录已失效'), { status: 401 });
    return user;
  };
  router.use(require('./neteaseLogin').createNeteaseLoginRouter({ profile, wrap, goFetch }));
  router.use(require('./playlistWrite').createPlaylistWriteRouter({ call, auth, profile, wrap, coverFetch }));
  const songId = req => {
    const id = String(req.body.id || '');
    if (!/^\d{1,20}$/.test(id)) throw Object.assign(new Error('歌曲标识无效'), { status: 400 });
    return id;
  };
  router.post('/suggestions', wrap(async (req, res) => {
    const cookie = auth(req), keywords = String(req.body.query || '').trim().slice(0, 200);
    if (!keywords) return res.json({ suggestions: [] });
    const data = await call('search_suggest', { cookie, keywords, type: 'mobile' });
    const suggestions = [...new Set((data.result?.allMatch || [])
      .map(item => item.keyword)
      .filter(value => typeof value === 'string' && value.trim()))].slice(0, 10);
    res.json({ suggestions });
  }));
  router.post('/search', wrap(async (req, res) => {
    const cookie = auth(req), keywords = String(req.body.query || '').trim().slice(0, 200);
    if (!keywords) return res.status(400).json({ error: '请输入搜索关键词' });
    const limit = Math.min(50, Math.max(1, Number(req.body.limit) || 10)), offset = Math.max(0, Number(req.body.offset) || 0);
    const data = await call('cloudsearch', { cookie, keywords, type: 1, limit, offset });
    res.json({ songs: data.result?.songs || [], total: data.result?.songCount || 0 });
  }));
  router.post('/album-search', wrap(async (req, res) => {
    const cookie = auth(req), keywords = String(req.body.query || '').trim().slice(0, 200);
    if (!keywords) return res.status(400).json({ error: '请输入专辑名称' });
    const data = await call('cloudsearch', { cookie, keywords, type: 10, limit: 20 });
    res.json({ albums: data.result?.albums || [] });
  }));
  router.post('/playback', wrap(async (req, res) => {
    const cookie = auth(req), id = songId(req);
    const data = await call('song_url', { cookie, id, br: 320000 });
    const track = data.data?.find(item => String(item.id) === id);
    if (!track?.url) throw new Error('该歌曲暂无播放权限，可能受会员或版权限制');
    const url = new URL(track.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('平台返回了无效音源');
    res.json({ url: url.href.replace(/^http:/, 'https:'), isPreview: !!track.freeTrialInfo });
  }));
  router.post('/lyric', wrap(async (req, res) => {
    const data = await call('lyric', { cookie: auth(req), id: songId(req) });
    res.json({ lyric: data.lrc?.lyric || '', translation: data.tlyric?.lyric || '', romanization: data.romalrc?.lyric || '' });
  }));
  router.post('/account', wrap(async (req, res) => res.json(await profile(auth(req)))));
  router.post('/logout', wrap(async (req, res) => { const cookie = auth(req); await call('logout', { cookie }); res.json({ success: true }); }));
  router.post('/collection', wrap(async (req, res) => {
    const cookie = auth(req); await profile(cookie);
    const { id, kind } = req.body;
    if (!/^\d{1,20}$/.test(String(id)) || !['playlists', 'albums'].includes(kind)) return res.status(400).json({ error: '无效的歌单或专辑标识' });
    const offset = Math.max(0, Number(req.body.offset) || 0), limit = 30;
    const data = await call(kind === 'albums' ? 'album' : 'playlist_track_all', { cookie, id, offset, limit });
    const songs = kind === 'albums' ? (data.songs || []).slice(offset, offset + limit) : data.songs || [];
    const playlist = kind === 'playlists' && offset === 0 ? (await call('playlist_detail', { cookie, id })).playlist : null;
    res.json({ ...(playlist ? { metadata: { title: playlist.name, image: playlist.coverImgUrl } } : {}), items: songs.map(s => ({ neteaseTrack: s, id: String(s.id), title: s.name, subtitle: (s.ar || s.artists || []).map(a => a.name).join(' / '), externalUrl: `https://music.163.com/#/song?id=${s.id}` })), hasMore: songs.length === limit });
  }));
  router.post('/library', wrap(async (req, res) => {
    const cookie = auth(req);
    const user = await profile(cookie);
    const offset = Math.max(0, Number(req.body.offset) || 0), limit = 30;
    const { kind } = req.body;
    let data, list;
    if (kind === 'playlists') {
      data = await call('user_playlist', { cookie, uid: user.userId, limit, offset });
      list = data.playlist || [];
      return res.json({ items: list.filter(p => String(p.creator?.userId) === String(user.userId) && p.specialType !== 5).map(p => ({ id: String(p.id), title: p.name, subtitle: `${p.trackCount || 0} 首`, image: p.coverImgUrl, externalUrl: `https://music.163.com/#/playlist?id=${p.id}` })), hasMore: data.more ?? list.length === limit });
    }
    if (kind === 'albums') {
      data = await call('album_sublist', { cookie, limit, offset });
      list = data.data || [];
      return res.json({ items: list.map(a => ({ id: String(a.id), title: a.name, subtitle: (a.artists || []).map(s => s.name).join(' / '), image: a.picUrl, externalUrl: `https://music.163.com/#/album?id=${a.id}` })), hasMore: data.hasMore ?? offset + list.length < data.count });
    }
    if (kind !== 'liked') return res.status(400).json({ error: '不支持的曲库分类' });
    const playlists = await call('user_playlist', { cookie, uid: user.userId, limit: 1000 });
    const liked = playlists.playlist?.find(p => String(p.creator?.userId) === String(user.userId) && (p.specialType === 5 || /我喜欢的音乐$/.test(p.name)));
    if (!liked) return res.json({ items: [], hasMore: false });
    data = await call('playlist_track_all', { cookie, id: liked.id, limit, offset });
    list = data.songs || [];
    res.json({ items: list.map(s => ({ neteaseTrack: s, id: String(s.id), title: s.name, subtitle: (s.ar || []).map(a => a.name).join(' / '), image: s.al?.picUrl, externalUrl: `https://music.163.com/#/song?id=${s.id}` })), hasMore: offset + list.length < liked.trackCount });
  }));
  return router;
}
module.exports = { createMusicPlatformsRouter };

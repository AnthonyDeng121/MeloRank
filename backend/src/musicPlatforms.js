const express = require('express');

function createMusicPlatformsRouter(getApi = () => require('@neteasecloudmusicapienhanced/api')) {
  const router = express.Router();
  const call = async (name, params) => {
    const response = await getApi()[name]({ ...params, timestamp: Date.now() });
    const body = response.body || {};
    if ((response.status || 200) >= 400 || (body.code && ![200, 800, 801, 802, 803].includes(body.code))) throw Object.assign(new Error(body.msg || body.message || '网易云接口请求失败'), { status: body.code === 301 ? 401 : 502 });
    return body;
  };
  const wrap = handler => async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await handler(req, res); } catch (error) { res.status(error.status || 502).json({ error: error.status === 401 ? '登录已失效，请重新扫码' : error.message || '网易云接口暂不可用' }); }
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
  router.post('/qr', wrap(async (_, res) => {
    const key = await call('login_qr_key', {});
    const unikey = key.data?.unikey;
    if (!unikey) throw new Error('未获得网易云登录二维码');
    const qr = await call('login_qr_create', { key: unikey, qrimg: true });
    res.json({ key: unikey, image: qr.data?.qrimg });
  }));
  router.post('/qr/check', wrap(async (req, res) => {
    if (!/^[\w-]{8,200}$/.test(req.body.key || '')) return res.status(400).json({ error: '二维码参数无效' });
    const result = await call('login_qr_check', { key: req.body.key });
    const cookie = result.cookie || '';
    res.json({ code: result.code, ...(result.code === 803 && cookie ? { cookie, profile: await profile(cookie) } : {}) });
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
    res.json({ items: songs.map(s => ({ id: String(s.id), title: s.name, subtitle: (s.ar || s.artists || []).map(a => a.name).join(' / '), externalUrl: `https://music.163.com/#/song?id=${s.id}` })), hasMore: songs.length === limit });
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
    res.json({ items: list.map(s => ({ id: String(s.id), title: s.name, subtitle: (s.ar || []).map(a => a.name).join(' / '), image: s.al?.picUrl, externalUrl: `https://music.163.com/#/song?id=${s.id}` })), hasMore: offset + list.length < liked.trackCount });
  }));
  return router;
}
module.exports = { createMusicPlatformsRouter };

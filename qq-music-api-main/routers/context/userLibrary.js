const axios = require('axios');
const { resolveCookie, getUin } = require('../../util/requestAuth');
const { getGtk } = require('../../util/loginUtils');

module.exports = async ctx => {
  const cookie = resolveCookie();
  const uin = getUin(cookie);
  ctx.set('Cache-Control', 'no-store');
  if (!cookie || uin === '0') { ctx.status = 401; ctx.body = { error: '请先登录 QQ 音乐' }; return; }
  const offset = Math.max(0, Number(ctx.query.offset) || 0), limit = 30;
  const key = /(?:^|;\s*)(?:qm_keyst|qqmusic_key|p_skey)=([^;]+)/.exec(cookie)?.[1] || '';
  const request = async (path, params) => {
    const response = await axios.get(`https://c.y.qq.com${path}`, { params: { format: 'json', inCharset: 'utf8', outCharset: 'utf-8', g_tk: getGtk(key), loginUin: uin, ...params }, headers: { Cookie: cookie, Referer: 'https://y.qq.com/portal/profile.html' }, timeout: 12000 });
    const data = response.data;
    if (![0, undefined].includes(data.code)) throw Object.assign(new Error('QQ 音乐拒绝读取曲库，请检查登录有效性或歌单隐私设置'), { status: data.code === 1000 ? 401 : 502 });
    return data;
  };
  const playlists = async () => (await request('/rsc/fcgi-bin/fcg_user_created_diss', { hostuin: uin, sin: 0, size: 1000, platform: 'yqq.json', needNewCode: 0 })).data?.disslist || [];
  try {
    if (ctx.query.kind === 'collection') {
      const id = String(ctx.query.id || '');
      if (!/^[a-zA-Z0-9]{1,32}$/.test(id)) { ctx.status = 400; ctx.body = { error: '无效的歌单或专辑标识' }; return; }
      let songs;
      if (ctx.query.type === 'albums') {
        const { UCommon } = require('../../module');
        const result = await UCommon({ method: 'get', params: { format: 'json', data: JSON.stringify({ req: { module: 'music.musichallAlbum.AlbumSongList', method: 'GetAlbumSongList', param: { albumMid: id, albumID: 0, begin: offset, num: limit, order: 2 } } }) }, cookie, option: { headers: { Cookie: cookie } } });
        if (result.data?.req?.code !== 0) throw new Error('专辑歌曲暂不可用');
        songs = (result.data.req.data?.songList || []).map(s => s.songInfo || s);
      } else {
        const data = await request('/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', { disstid: id, type: 1, json: 1, utf8: 1, new_format: 1 });
        songs = (data.cdlist?.[0]?.songlist || []).slice(offset, offset + limit);
      }
      ctx.body = { items: songs.map(s => { const mid = s.mid || s.songmid; return { id: mid, title: s.title || s.songname, subtitle: (s.singer || []).map(a => a.name).join(' / '), externalUrl: `https://y.qq.com/n/ryqq/songDetail/${mid}`, qqSong: { songmid: mid, songname: s.title || s.songname, singer: s.singer || [], albummid: s.album?.mid || s.albummid || '', albumname: s.album?.name || s.albumname || '' } }; }), hasMore: songs.length === limit }; return;
    }
    if (ctx.query.kind === 'playlists') {
      const list = await playlists();
      const owned = list.filter(p => Number(p.dirid) !== 201);
      ctx.body = { items: owned.slice(offset, offset + limit).map(p => ({ id: String(p.tid), title: p.diss_name, subtitle: `${p.song_cnt || 0} 首`, image: p.diss_cover, externalUrl: `https://y.qq.com/n/ryqq/playlist/${p.tid}` })), hasMore: offset + limit < owned.length }; return;
    }
    if (ctx.query.kind === 'albums') {
      const data = (await request('/fav/fcgi-bin/fcg_get_profile_order_asset.fcg', { ct: 20, cid: 205360956, userid: uin, reqtype: 2, sin: offset, ein: offset + limit - 1 })).data || {};
      const list = data.albumlist || [];
      ctx.body = { items: list.map(a => ({ id: String(a.albummid || a.albumid), title: a.albumname || a.album_name, subtitle: a.singername || a.singer_name || '', image: a.albummid ? `https://y.qq.com/music/photo_new/T002R300x300M000${a.albummid}.jpg` : '', externalUrl: `https://y.qq.com/n/ryqq/albumDetail/${a.albummid || a.albumid}` })), hasMore: offset + list.length < data.totalalbum }; return;
    }
    if (ctx.query.kind !== 'liked') { ctx.status = 400; ctx.body = { error: '不支持的曲库分类' }; return; }
    const list = await playlists();
    let id = list.find(p => Number(p.dirid) === 201)?.tid;
    if (!id) {
      const profile = await request('/rsc/fcgi-bin/fcg_get_profile_homepage.fcg', { cid: 205360838, userid: uin, reqfrom: 1 });
      id = profile.data?.mymusic?.find(m => Number(m.type) === 0 || /喜欢/.test(m.title || m.name || ''))?.id;
    }
    if (!id) { ctx.body = { items: [], hasMore: false }; return; }
    const data = await request('/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', { disstid: id, type: 1, json: 1, utf8: 1, new_format: 1 });
    const songs = data.cdlist?.[0]?.songlist || [];
    ctx.body = { items: songs.slice(offset, offset + limit).map(s => {
      const mid = s.mid || s.songmid, albumMid = s.album?.mid || s.albummid;
      return { id: mid, title: s.title || s.songname, subtitle: (s.singer || []).map(a => a.name).join(' / '), image: albumMid ? `https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg` : '', externalUrl: `https://y.qq.com/n/ryqq/songDetail/${mid}`, qqSong: { songmid: mid, songname: s.title || s.songname, singer: s.singer || [], albummid: albumMid || '', albumname: s.album?.name || s.albumname || '' } };
    }), hasMore: offset + limit < songs.length };
  } catch (error) { ctx.status = error.status || 502; ctx.body = { error: error.message || 'QQ 曲库暂不可用' }; }
};

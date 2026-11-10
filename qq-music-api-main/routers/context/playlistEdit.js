const axios = require('axios');
const { resolveCookie, getUin } = require('../../util/requestAuth');
const { getGtk } = require('../../util/loginUtils');
const { playlistRpc } = require('../../util/playlistRpc');
const locks = new Set();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function createPlaylistEdit({ rpc = playlistRpc, get = axios.get } = {}) {
  return async ctx => {
    ctx.set('Cache-Control', 'no-store');
    try {
      const cookie = resolveCookie(), uin = getUin(cookie);
      if (!cookie || uin === '0') throw fail('请先登录 QQ 音乐', 401);
      const { id, action, trackId, baseIds, ids, name, baseName, coverTrackId } = ctx.request.body || {};
      const validMid = value => typeof value === 'string' && /^[a-zA-Z0-9]{1,32}$/.test(value);
      const validList = value => Array.isArray(value) && value.length <= 10000 && value.every(validMid) && new Set(value).size === value.length;
      if (typeof id !== 'string' || !/^[1-9]\d{0,19}$/.test(id) || !Number.isSafeInteger(Number(id)) || !['add', 'remove', 'reorder', 'metadata'].includes(action)
        || !validList(baseIds) || (action === 'reorder' ? !validList(ids) : action === 'metadata'
          ? typeof name !== 'string' || !name.trim() || name.trim().length > 20 || typeof baseName !== 'string' || coverTrackId !== undefined && !validMid(coverTrackId)
          : !validMid(trackId))) throw fail('无效的歌单编辑参数');
      const lock = `${uin}:${id}`;
      if (locks.has(lock)) throw fail('歌单正在保存，请稍后刷新重试', 409);
      locks.add(lock);
      try {
        const key = /(?:^|;\s*)(?:qm_keyst|qqmusic_key|p_skey)=([^;]+)/.exec(cookie)?.[1] || '';
        const response = await get('https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss', { params: { hostuin: uin, sin: 0, size: 1000, format: 'json', g_tk: getGtk(key), loginUin: uin, platform: 'yqq.json', needNewCode: 0 }, headers: { Cookie: cookie, Referer: 'https://y.qq.com/' }, timeout: 12000, maxRedirects: 0 });
        if (response.data?.code !== 0) throw fail('无法核实当前账号的歌单，请重新登录', 401);
        const owned = response.data.data?.disslist?.filter(value => String(value.tid) === id);
        const dirId = Number(owned?.[0]?.dirid);
        if (owned?.length !== 1 || !Number.isSafeInteger(dirId) || dirId <= 0 || dirId >= 201 && dirId <= 206) throw fail('只能编辑自己创建的普通歌单', 403);
        const read = async () => {
          const songs = [];
          let total;
          do {
            const data = await rpc(cookie, 'music.srfDissInfo.DissInfo', 'CgiGetDiss', { disstid: Number(id), dirid: dirId, tag: true, userinfo: true, orderlist: true, song_begin: songs.length, song_num: 100 });
            const info = data?.dirinfo;
            if (String(info?.id) !== id || Number(info.dirid) !== dirId || Number(info.owndir) !== 1) throw fail('歌单归属校验失败', 403);
            if (!Array.isArray(data.songlist) || !Number.isSafeInteger(data.total_song_num) || data.total_song_num > 10000) throw fail('无法读取完整歌单', 502);
            total = data.total_song_num;
            if (!data.songlist.length && songs.length < total) throw fail('歌单读取不完整，请刷新重试', 502);
            songs.push(...data.songlist);
          } while (songs.length < total);
          if (songs.length !== total || songs.some(song => !validMid(song.mid)) || new Set(songs.map(song => song.mid)).size !== total) throw fail('歌单数据不完整，请刷新重试', 502);
          return songs;
        };
        const current = await read(), currentIds = current.map(song => song.mid);
        // Sorting must compare the ordered snapshot; add/remove only compare
        // membership because those operations never write song order.
        if (!(action === 'reorder' ? same(currentIds, baseIds) : same([...currentIds].sort(), [...baseIds].sort()))) throw fail('歌单已在其他位置更新，请刷新歌单后重新编辑', 409);
        if (action === 'metadata') {
          const readInfo = async () => {
            const data = await rpc(cookie, 'music.srfDissInfo.aiDissInfo', 'uniform_get_Dissinfo', { dirid: dirId, optype: 3, tag: 1, userinfo: 0, pic_dpi: 300 });
            const info = data?.dirinfo;
            if (String(info?.id) !== id || Number(info.dirid) !== dirId || Number(info.owndir) !== 1) throw fail('歌单归属校验失败', 403);
            return info;
          };
          const info = await readInfo();
          if (info.title !== baseName) throw fail('歌单名称已在其他位置更新，请刷新后重试', 409);
          if (![info.title, info.desc, info.picurl, info.picurl2].every(value => typeof value === 'string') || ![1, 2].includes(info.dir_show)) throw fail('歌单资料不完整，未保存以避免覆盖原有设置', 502);
          const tags = Array.isArray(info.vec_tagid) ? info.vec_tagid : Array.isArray(info.tag) ? info.tag.map(tag => tag.id) : null;
          if (!tags || !tags.every(tag => Number.isSafeInteger(tag) && tag >= 0)) throw fail('歌单标签读取不完整', 502);
          let cover = info.picurl, cover2 = info.picurl2;
          if (coverTrackId) {
            const album = current.find(song => song.mid === coverTrackId)?.album;
            if (!album?.mid || !/^[a-zA-Z0-9]{1,32}$/.test(album.mid)) throw fail('请从歌单中选择有专辑封面的歌曲');
            cover = `https://y.qq.com/music/photo_new/T002R300x300M000${album.mid}.jpg`;
            cover2 = cover;
          }
          if (name.trim() !== info.title || coverTrackId) await rpc(cookie, 'music.musicasset.PlaylistBaseWrite', 'EditPlaylist', {
            dirId, mask: 95, dirNewName: name.trim(), dirNewDesc: info.desc, dirNewPicUrl: cover, dirNewPicUrl2: cover2,
            dirNewtaglist: tags.join(','), dirShow: info.dir_show,
          });
          const actual = await readInfo();
          const sameCover = !coverTrackId || actual.picurl?.split('?')[0] === cover.split('?')[0];
          if (actual.title !== name.trim() || !sameCover) throw fail('平台读回的歌单资料不一致，请刷新检查', 409);
          ctx.body = { success: true, metadata: { title: actual.title, image: actual.picurl } };
          return;
        }
        if (action === 'reorder' && (ids.length !== currentIds.length || !ids.every(mid => currentIds.includes(mid)))) throw fail('排序必须保留歌单内的全部歌曲');
        if (action === 'reorder' && !same(currentIds, ids)) {
          const byMid = new Map(current.map(song => [song.mid, song]));
          const v_songPair = ids.map(mid => {
            const song = byMid.get(mid);
            if (!Number.isSafeInteger(song.id) || song.id <= 0 || !Number.isSafeInteger(song.type)) throw fail('未能核实歌曲标识与类型', 502);
            return { songId: song.id, songType: song.type };
          });
          // Official QQMusic 21.81 protocol serializer, VA 0x100ee0bf:
          // SeqSonglist { dirId, tid, v_songPair: [{ songType, songId }] }.
          await rpc(cookie, 'music.musicasset.PlaylistDetailWrite', 'SeqSonglist', { dirId, tid: Number(id), v_songPair });
        }
        const exists = currentIds.includes(trackId);
        if (action !== 'reorder' && (action === 'add' ? !exists : exists)) {
          const song = action === 'remove' ? current.find(value => value.mid === trackId)
            : (await rpc(cookie, 'music.pf_song_detail_svr', 'get_song_detail_yqq', { song_mid: trackId, song_type: 0, song_id: 0 }))?.track_info;
          if (song?.mid !== trackId || !Number.isSafeInteger(song.id) || song.id <= 0 || !Number.isSafeInteger(song.type)) throw fail('未能核实歌曲标识与类型', 502);
          await rpc(cookie, 'music.musicasset.PlaylistDetailWrite', action === 'add' ? 'AddSonglist' : 'DelSonglist', { dirId, v_songInfo: [{ songId: song.id, songType: song.type }] });
        }
        const expected = action === 'reorder' ? ids : action === 'add' ? [...new Set([...currentIds, trackId])] : currentIds.filter(value => value !== trackId);
        const actual = (await read()).map(song => song.mid);
        if (!(action === 'reorder' ? same(actual, expected) : same([...actual].sort(), [...expected].sort()))) throw fail('已提交修改，但平台读回结果不一致，请刷新检查后再操作', 409);
        ctx.body = { success: true, ids: actual };
      } finally { locks.delete(lock); }
    } catch (error) {
      ctx.status = error.status || 502;
      ctx.body = { error: error.status ? error.message : 'QQ 歌单请求失败，修改可能已提交，请刷新检查后再操作' };
    }
  };
}
module.exports = createPlaylistEdit();
module.exports.createPlaylistEdit = createPlaylistEdit;

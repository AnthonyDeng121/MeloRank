// Compare the caller's snapshot before writing so a stale page cannot overwrite
// edits made in the official app. Never replace a playlist to implement sorting.
const locks = new Set();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function createPlaylistWriteRouter({ call, auth, profile, wrap, coverFetch = fetch }) {
  const router = require('express').Router();
  router.post('/playlist/edit', wrap(async (req, res) => {
    const cookie = auth(req), { id, action, trackId, baseIds, ids, name, baseName, coverTrackId, coverData } = req.body;
    const validId = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);
    const validList = value => Array.isArray(value) && value.length <= 10000 && value.every(validId) && new Set(value).size === value.length;
    if (!validId(id) || !['add', 'remove', 'reorder', 'metadata'].includes(action) || !validList(baseIds)
      || (action === 'reorder' ? !validList(ids) : action === 'metadata'
        ? typeof name !== 'string' || !name.trim() || name.trim().length > 40 || typeof baseName !== 'string' || coverTrackId !== undefined && !validId(coverTrackId)
        : !validId(trackId))) throw fail('无效的歌单编辑参数');
    if (coverData !== undefined && (action !== 'metadata' || coverTrackId !== undefined)) throw fail('封面参数冲突');
    const localImage = coverData === undefined ? null : require('./coverImage').decodeCoverImage(coverData);
    const user = await profile(cookie);
    const key = `${user.userId}:${id}`;
    if (locks.has(key)) throw fail('歌单正在保存，请稍后刷新重试', 409);
    locks.add(key);
    try {
      let metadata;
      const read = async () => {
        const { playlist } = await call('playlist_detail', { cookie, id });
        if (String(playlist?.creator?.userId) !== String(user.userId) || playlist?.specialType === 5) throw fail('只能编辑自己创建的普通歌单', 403);
        const current = playlist.trackIds?.map(track => String(track.id));
        if (!validList(current) || current.length !== playlist.trackCount) throw fail('未能读取完整歌单，请刷新后重试', 502);
        metadata = playlist;
        return current;
      };
      const current = await read();
      if (!same(current, baseIds)) throw fail('歌单已在其他位置更新，请刷新歌单后重新编辑', 409);
      if (action === 'metadata') {
        if (metadata.name !== baseName) throw fail('歌单名称已在其他位置更新，请刷新后重试', 409);
        if (coverTrackId && !current.includes(coverTrackId)) throw fail('请从当前歌单歌曲中选择封面');
        if (name.trim() !== metadata.name) {
          const result = await call('playlist_name_update', { cookie, id, name: name.trim() });
          if (result.code !== 200) throw fail('平台未确认歌单名称更新', 502);
        }
        let imageId;
        if (localImage) {
          const result = await call('playlist_cover_update', { cookie, id, imgFile: localImage });
          if (result.code !== 200 || !result.data?.imgId) throw fail('平台未确认封面上传', 502);
          imageId = result.data.imgId;
        }
        if (coverTrackId) {
          const detail = await call('song_detail', { cookie, ids: coverTrackId });
          const cover = detail.songs?.find(song => String(song.id) === coverTrackId)?.al?.picUrl;
          const url = new URL((cover || 'https://invalid.example/').replace(/^http:/, 'https:'));
          if (url.protocol !== 'https:' || !/(^|\.)music\.126\.net$/.test(url.hostname) || url.username || url.password) throw fail('平台专辑封面不可用', 502);
          const response = await coverFetch(url.href, { redirect: 'error', signal: AbortSignal.timeout(15000) });
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/') || Number(response.headers.get('content-length')) > 5242880) throw fail('封面下载失败或图片超过 5 MB', 502);
          const image = Buffer.from(await response.arrayBuffer());
          if (!image.length || image.length > 5242880) throw fail('封面图片大小不符合要求', 502);
          const result = await call('playlist_cover_update', { cookie, id, imgFile: { name: 'cover.jpg', mimetype: 'image/jpeg', data: image, size: image.length } });
          if (result.code !== 200 || !result.data?.imgId) throw fail('平台未确认封面更新', 502);
          imageId = result.data.imgId;
        }
        await read();
        if (metadata.name !== name.trim() || imageId && String(metadata.coverImgId) !== String(imageId)) throw fail('平台读回的歌单资料不一致，请刷新检查', 409);
        return res.json({ success: true, metadata: { title: metadata.name, image: metadata.coverImgUrl } });
      }
      let expected;
      if (action === 'reorder') {
        if (ids.length !== current.length || !ids.every(value => current.includes(value))) throw fail('排序必须保留歌单内的全部歌曲');
        expected = ids;
      } else {
        expected = action === 'add' ? current.includes(trackId) ? current : [...current, trackId] : current.filter(value => value !== trackId);
      }
      if (!same(expected, current)) {
        const response = action === 'reorder'
          ? await call('song_order_update', { cookie, pid: id, ids: JSON.stringify(ids) })
          : await call('playlist_tracks', { cookie, pid: id, op: action === 'add' ? 'add' : 'del', tracks: trackId });
        // playlist_tracks in this SDK can wrap the upstream body a second time.
        const result = response.body || response;
        if (result.code !== 200) throw fail(result.message || result.msg || '平台未确认保存成功，请刷新检查', 502);
      }
      const actual = await read();
      const verified = action === 'reorder' ? same(actual, expected)
        : same([...actual].sort(), [...expected].sort());
      if (!verified) throw fail('已提交修改，但平台读回结果不一致，请刷新检查后再操作', 409);
      res.json({ success: true, ids: actual });
    } finally { locks.delete(key); }
  }));
  return router;
}
module.exports = { createPlaylistWriteRouter };

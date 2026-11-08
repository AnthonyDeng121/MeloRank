// Compare the caller's snapshot before writing so a stale page cannot overwrite
// edits made in the official app. Never replace a playlist to implement sorting.
const locks = new Set();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function createPlaylistWriteRouter({ call, auth, profile, wrap }) {
  const router = require('express').Router();
  router.post('/playlist/edit', wrap(async (req, res) => {
    const cookie = auth(req), { id, action, trackId, baseIds, ids } = req.body;
    const validId = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value);
    const validList = value => Array.isArray(value) && value.length <= 10000 && value.every(validId) && new Set(value).size === value.length;
    if (!validId(id) || !['add', 'remove', 'reorder'].includes(action) || !validList(baseIds)
      || (action === 'reorder' ? !validList(ids) : !validId(trackId))) throw fail('无效的歌单编辑参数');
    const user = await profile(cookie);
    const key = `${user.userId}:${id}`;
    if (locks.has(key)) throw fail('歌单正在保存，请稍后刷新重试', 409);
    locks.add(key);
    try {
      const read = async () => {
        const { playlist } = await call('playlist_detail', { cookie, id });
        if (String(playlist?.creator?.userId) !== String(user.userId) || playlist?.specialType === 5) throw fail('只能编辑自己创建的普通歌单', 403);
        const current = playlist.trackIds?.map(track => String(track.id));
        if (!validList(current) || current.length !== playlist.trackCount) throw fail('未能读取完整歌单，请刷新后重试', 502);
        return current;
      };
      const current = await read();
      if (!same(current, baseIds)) throw fail('歌单已在其他位置更新，请刷新歌单后重新编辑', 409);
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

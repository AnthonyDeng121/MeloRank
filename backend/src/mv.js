const express = require('express');
const router = express.Router();
router.post('/:action', async (req, res) => {
  try {
    const { provider, query, id, page = 1 } = req.body;
    if (!['qq', 'netease'].includes(provider)) return res.status(400).json({ error: '该平台暂不支持 MV' });
    const search = req.params.action === 'search';
    if (!['search', 'play'].includes(req.params.action)) return res.sendStatus(404);
    if (search && !String(query || '').trim()) return res.status(400).json({ error: '请输入关键词' });
    if (!search && !/^[\w-]{1,80}$/.test(String(id || ''))) return res.status(400).json({ error: 'MV 标识无效' });
    if (provider === 'netease') {
      const api = require('@neteasecloudmusicapienhanced/api');
      const cookie = req.get('X-Netease-Cookie') || '';
      if (search) {
        const response = await api.cloudsearch({ keywords: String(query).slice(0, 200), type: 1004, limit: 20, offset: (Math.max(1, Number(page) || 1) - 1) * 20, cookie });
        const data = response.body.result || {};
        return res.json({ items: (data.mvs || []).map(m => ({ id: String(m.id), title: m.name, artist: m.artistName || (m.artists || []).map(a => a.name).join(' / '), image: m.cover, duration: m.duration / 1000 })), total: data.mvCount || 0 });
      }
      const [detail, playback] = await Promise.all([api.mv_detail({ mvid: id, cookie }), api.mv_url({ id, r: 720, cookie })]);
      if (!playback.body.data?.url) throw new Error('此 MV 暂无播放权限');
      return res.json({ url: playback.body.data.url, description: detail.body.data?.desc || '', title: detail.body.data?.name });
    }
    const endpoint = search ? `/getSearchByKey?${new URLSearchParams({ key: String(query).slice(0, 200), catZhida: '4', limit: '20', page: String(Math.max(1, Number(page) || 1)) })}` : `/getMvPlay?vid=${encodeURIComponent(id)}`;
    const response = await fetch(`http://127.0.0.1:3200${endpoint}`, { headers: { 'X-QQ-Music-Cookie': req.get('X-QQ-Music-Cookie') || '' }, signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'QQ MV 接口暂不可用');
    const data = result.response;
    if (search) { const group = data?.data?.mv || {}; return res.json({ items: (group.list || []).map(m => ({ id: String(m.vid || m.v_id || m.mv_id || ''), title: m.title || m.mv_name || m.name, artist: m.singer_name || (m.singers || m.singer || []).map(a => a.name).join(' / '), image: m.mv_pic_url || m.picurl || m.cover_pic, duration: m.duration })), total: group.totalnum || 0 }); }
    const streams = data?.getMVUrl?.data?.[id]?.mp4 || [];
    const urls = streams.filter(stream => stream.code === 0).flatMap(stream => stream.freeflow_url || []).concat(Object.values(data?.playLists || {}).flat()).filter(url => typeof url === 'string' && /^https?:\/\//.test(url));
    if (!urls.length) throw new Error('此 MV 暂无可用播放地址');
    const detail = data?.mvinfo?.data?.[id] || {};
    return res.json({ url: urls.find(url => url.startsWith('https://')) || urls[0], title: detail.name, description: detail.desc || '', duration: detail.duration });
  } catch (error) { res.status(502).json({ error: error.message || 'MV 请求失败' }); }
});
module.exports = router;

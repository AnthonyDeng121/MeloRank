const { resolveCookie } = require('../../../util/requestAuth');
module.exports = async ({ params = {} }) => {
  const moduleName = 'music.search.SearchCgiService';
  const type = Number(params.catZhida) === 3 ? 2 : Number(params.catZhida) === 2 ? 1 : 0;
  const group = ['song', 'singer', 'album'][type];
  const payload = { [moduleName]: { module: moduleName, method: 'DoSearchForQQMusicDesktop', param: {
    query: params.w, search_type: type, page_num: Math.max(1, Number(params.p) || 1), num_per_page: Math.min(50, Math.max(1, Number(params.n) || 10)),
  } } };
  try {
    const response = await fetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(JSON.stringify(payload))}`, {
      headers: { Referer: 'https://y.qq.com/', Cookie: resolveCookie() || '' }, signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`QQ search HTTP ${response.status}`);
    const result = await response.json();
    const entry = result[moduleName];
    if (result.code !== 0 || entry?.code !== 0 || !entry.data?.body?.[group]) throw new Error('QQ search returned an invalid response');
    const data = entry.data;
    const list = data.body[group].list || [];
    const normalized = type === 0 ? list.map(song => ({ ...song, songmid: song.mid, songname: song.name, albummid: song.album?.mid, albumname: song.album?.name })) : list;
    return { status: 200, body: { response: { code: 0, data: { [group]: { list: normalized, totalnum: Number(data.meta?.sum ?? data.meta?.estimate_sum ?? list.length), curpage: data.meta?.curpage } } } } };
  } catch (error) { return { status: 502, body: { error: error.message || 'QQ search unavailable' } }; }
};

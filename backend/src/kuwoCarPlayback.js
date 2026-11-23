const { verifyAlternative } = require('./verifyAlternative');

const normalize = value => String(value || '').replace(/&nbsp;/g, ' ').replace(/\\+u0026/g, '&').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
const baseTitle = value => String(value || '').split(/\s*[?(]/)[0].trim();
async function kuwoCarPlayback({ title, artists, album, duration }, signal) {
  const search = new URL('https://search.kuwo.cn/r.s');
  search.search = new URLSearchParams({ all: baseTitle(title), ft: 'music', rformat: 'json', encoding: 'utf8', pn: '0', rn: '30', vipver: '1', show_copyright_off: '1', prod: 'kwplayer_mc_1.7.0' });
  const response = await fetch(search, { signal });
  if (!response.ok) throw new Error('酷我歌曲搜索失败');
  // The legacy endpoint returns a Python-style dictionary rather than JSON.
  const text = await response.text();
  const data = JSON.parse(text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => JSON.stringify(value.replace(/\\'/g, "'"))));
  const expected = Number(duration);
  const candidates = (data.abslist || []).filter(item => normalize(baseTitle(item.NAME)) === normalize(baseTitle(title))
    && artists.every(artist => normalize(item.ARTIST).includes(normalize(artist)))
    && (!expected || Math.abs(Number(item.DURATION) - expected) <= 5));
  candidates.sort((a, b) => Number(normalize(b.ALBUM) === normalize(album)) - Number(normalize(a.ALBUM) === normalize(album)));
  for (const song of candidates.slice(0, 3)) {
    try {
      const api = new URL('https://mobi.kuwo.cn/mobi.s');
      api.search = new URLSearchParams({ f: 'web', source: 'kwplayercar_ar_6.0.0.9_B_jiakong_vh.apk', from: 'PC', type: 'convert_url_with_sign', br: '320kmp3', rid: song.MUSICRID.replace('MUSIC_', ''), user: `C_APK_guanwang_${Date.now()}` });
      const result = await (await fetch(api, { signal, headers: { 'User-Agent': 'okhttp/3.10.0' } })).json();
      const audio = result.data;
      if (result.code !== 200 || !audio?.url || audio.ekey || audio.format !== 'mp3') continue;
      const url = new URL(audio.url.replace(/^http:/, 'https:'));
      if (!url.hostname.endsWith('.kuwo.cn')) continue;
      const verifiedDuration = await verifyAlternative(url.href, expected || Number(song.DURATION));
      if (Math.abs(verifiedDuration - (expected || Number(song.DURATION))) > 5) continue;
      return { url: url.href, source: 'kuwo-car', br: Number(audio.bitrate) * 1000, verifiedDuration };
    } catch (error) { if (signal?.aborted) throw error; }
  }
  throw new Error('酷我车机兜底未找到匹配的完整音频');
}
module.exports = { kuwoCarPlayback };

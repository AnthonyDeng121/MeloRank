const axios = require('axios');
const { zzcSign, encodeAG1Request, decodeAG1Response } = require('@jixun/qmweb-sign');
const { getGtk } = require('./loginUtils');
const { getUin } = require('./requestAuth');

// Web protocol: https://github.com/jixunmoe/qmweb-sign (MIT).
// Use the signed channel for writes; never retry a write through another endpoint.
async function playlistRpc(cookie, module, method, param) {
  const key = /(?:^|;\s*)(?:qqmusic_key|qm_keyst|p_skey|skey)=([^;]+)/.exec(cookie)?.[1] || '';
  const data = JSON.stringify({ comm: { ct: 24, cv: 4747474, uin: getUin(cookie), format: 'json', platform: 'yqq.json', g_tk: getGtk(key), g_tk_new_20200303: getGtk(key), needNewCode: 1 }, req: { module, method, param } });
  const response = await axios.post('https://u6.y.qq.com/cgi-bin/musics.fcg', await encodeAG1Request(data), {
    params: { encoding: 'ag-1', sign: zzcSign(data) }, timeout: 12000, maxRedirects: 0,
    headers: { Cookie: cookie, Referer: 'https://y.qq.com/', 'Content-Type': 'text/plain' }, responseType: 'arraybuffer',
  });
  const result = JSON.parse(decodeAG1Response(new Uint8Array(response.data)));
  if ([301, 1000].includes(result.code) || [301, 1000].includes(result.req?.code)) {
    throw Object.assign(new Error('QQ 音乐登录已失效，请重新扫码登录'), { status: 401 });
  }
  if (result.code !== 0 || result.req?.code !== 0
    || (result.req.data?.code !== undefined && result.req.data.code !== 0)
    || (result.req.data?.retCode !== undefined && result.req.data.retCode !== 0)) {
    throw Object.assign(new Error('QQ 音乐未接受请求，请检查登录状态或稍后刷新重试'), { status: 502 });
  }
  return result.req.data;
}
module.exports = { playlistRpc };

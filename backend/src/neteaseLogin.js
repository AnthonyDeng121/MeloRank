const express = require('express');

function createNeteaseLoginRouter({ profile, wrap, goFetch = fetch }) {
  const router = express.Router();
  const go = async (path, body) => {
    let response;
    try {
      response = await goFetch(`http://127.0.0.1:5001${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(18000) });
    } catch { throw new Error('Go 扫码服务未启动或连接超时，请先运行 npm run dev:netease-go'); }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Go 扫码接口请求失败');
    return result;
  };
  router.post('/go/qr', wrap(async (_, res) => res.json(await go('/qr', {}))));
  router.post('/go/qr/check', wrap(async (req, res) => {
    if (!/^[\w-]{8,200}$/.test(req.body.key || '')) return res.status(400).json({ error: '二维码参数无效' });
    const result = await go('/qr/check', { key: req.body.key });
    if (![800, 801, 802, 803].includes(result.code)) throw new Error('Go 扫码状态异常，请尝试其他登录方式');
    res.json({ code: result.code, ...(result.code === 803 && result.cookie ? { cookie: result.cookie, profile: await profile(result.cookie) } : {}) });
  }));
  return router;
}
module.exports = { createNeteaseLoginRouter };

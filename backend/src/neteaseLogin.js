const express = require('express');

function createNeteaseLoginRouter({ call, profile, wrap, goFetch = fetch }) {
  const router = express.Router();
  const cooldowns = new Map();
  const attempts = new Map();
  const phone = req => {
    const phone = String(req.body.phone || ''), countrycode = String(req.body.countrycode || '86');
    if (!/^\d{5,15}$/.test(phone) || !/^\d{1,4}$/.test(countrycode) || countrycode === '86' && !/^1\d{10}$/.test(phone)) {
      throw Object.assign(new Error('请填写正确的手机号和国家区号'), { status: 400 });
    }
    return { phone, countrycode };
  };
  router.post('/phone/code', wrap(async (req, res) => {
    const params = phone(req), now = Date.now();
    for (const [key, expiry] of cooldowns) if (expiry <= now) cooldowns.delete(key);
    const keys = [`phone:${params.countrycode}:${params.phone}`, `ip:${req.ip}`];
    if (keys.some(key => cooldowns.has(key))) throw Object.assign(new Error('请等待 60 秒后再获取验证码'), { status: 429 });
    if (cooldowns.size >= 2000) throw Object.assign(new Error('请求较多，请稍后再试'), { status: 429 });
    keys.forEach(key => cooldowns.set(key, now + 60000));
    await call('captcha_sent', { phone: params.phone, ctcode: params.countrycode });
    res.json({ success: true, retryAfter: 60 });
  }));
  router.post('/phone/login', wrap(async (req, res) => {
    const params = phone(req), captcha = String(req.body.captcha || '');
    if (!/^\d{4,8}$/.test(captcha)) throw Object.assign(new Error('请填写正确的短信验证码'), { status: 400 });
    const now = Date.now();
    for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
    const attemptKey = `${req.ip}:${params.countrycode}:${params.phone}`;
    const counter = attempts.get(attemptKey) || { count: 0, expires: now + 60000 };
    if (counter.count >= 5 || attempts.size >= 2000 && !attempts.has(attemptKey)) throw Object.assign(new Error('登录尝试过于频繁，请稍后重试'), { status: 429 });
    counter.count++; attempts.set(attemptKey, counter);
    const result = await call('login_cellphone', { ...params, captcha });
    if (!/(?:^|;)\s*MUSIC_U=/.test(result.cookie || '')) throw new Error('未获得登录凭证，请尝试官网登录');
    res.json({ cookie: result.cookie, profile: await profile(result.cookie) });
  }));
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

const assert = require('node:assert/strict');
const express = require('../backend/node_modules/express');
const { createNeteaseLoginRouter } = require('../backend/src/neteaseLogin');
let calls = [], goCalls = [], fail = false;
const app = express(); app.use(express.json());
app.use(createNeteaseLoginRouter({
  call: async (name, params) => { calls.push({ name, params }); if (fail) throw new Error('upstream'); return name === 'captcha_sent' ? { code: 200 } : { cookie: 'MUSIC_U=fixture;' }; },
  profile: async cookie => { assert.equal(cookie, 'MUSIC_U=fixture;'); return { userId: 7 }; },
  wrap: handler => async (req, res) => { try { await handler(req, res); } catch (error) { res.status(error.status || 502).json({ error: error.message }); } },
  goFetch: async (url, options) => { goCalls.push({ url, options }); return { ok: true, json: async () => url.endsWith('/check') ? { code: 803, cookie: 'MUSIC_U=fixture;' } : { key: 'fixture-go-session', image: 'data:image/png;base64,fixture' } }; },
}));
const server = app.listen(0, '127.0.0.1', async () => {
  try {
    const post = (path, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/phone/code', { phone: 'bad' })).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await post('/phone/code', { phone: '13800000000' })).status, 200);
    assert.equal(calls[0].name, 'captcha_sent');
    assert.equal(calls[0].params.ctcode, '86');
    assert.equal((await post('/phone/code', { phone: '13800000000' })).status, 429);
    assert.equal((await post('/phone/code', { phone: '13900000000' })).status, 429);
    assert.equal(calls.length, 1);
    assert.equal((await post('/phone/login', { phone: '13800000000', captcha: 'x' })).status, 400);
    const login = await (await post('/phone/login', { phone: '13800000000', captcha: '123456' })).json();
    assert.equal(login.profile.userId, 7);
    assert.equal(calls[1].params.captcha, '123456');
    assert.equal(calls[1].params.password, undefined);
    fail = true;
    assert.equal((await post('/phone/login', { phone: '13800000000', captcha: '123456' })).status, 502);
    for (let i = 0; i < 3; i++) assert.equal((await post('/phone/login', { phone: '13800000000', captcha: '123456' })).status, 502);
    assert.equal((await post('/phone/login', { phone: '13800000000', captcha: '123456' })).status, 429);
    const qr = await (await post('/go/qr', {})).json();
    assert.equal(qr.key, 'fixture-go-session');
    assert.equal((await post('/go/qr/check', { key: 'bad' })).status, 400);
    const checked = await (await post('/go/qr/check', { key: qr.key })).json();
    assert.equal(checked.profile.userId, 7);
    assert.equal(goCalls[0].url, 'http://127.0.0.1:5001/qr');
    console.log('PASS phone input validation, resend cooldown, OTP-only login and isolated Go QR forwarding');
  } catch (error) { console.error(error); process.exitCode = 1; } finally { server.close(); }
});

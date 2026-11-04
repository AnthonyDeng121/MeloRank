import React, { useEffect, useRef, useState } from 'react';
import { netease } from '../services/musicPlatforms';

export function NeteasePhoneLogin({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState('');
  const [countrycode, setCountrycode] = useState('86');
  const [captcha, setCaptcha] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef(new AbortController());
  useEffect(() => { controller.current = new AbortController(); return () => controller.current.abort(); }, []);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(value => value - 1), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const perform = async (login: boolean) => {
    if (busy) return;
    const signal = controller.current.signal;
    setBusy(true); setMessage('');
    try {
      const result = await netease.request(login ? 'phone/login' : 'phone/code', { phone, countrycode, ...(login ? { captcha } : {}) }, signal);
      if (signal.aborted) return;
      if (login) {
        if (!result.profile?.userId || !result.cookie) throw new Error('未能验证账号，请使用官网登录');
        await netease.connectCookie(result.cookie, signal);
        if (!signal.aborted) { setCaptcha(''); onDone(); }
      } else { setCooldown(result.retryAfter || 60); setMessage('验证码已发送，请查看手机短信'); }
    } catch (error) { if (!signal.aborted) setMessage(error instanceof Error ? error.message : '请求失败，请重试'); }
    finally { if (!signal.aborted) setBusy(false); }
  };
  return <form className="netease-cookie-login" onSubmit={event => { event.preventDefault(); void perform(true); }}>
    <p>使用已有网易云账号的手机号和短信验证码登录。若网易云要求安全验证，请改用官网登录。</p>
    <label htmlFor="netease-country">国家区号</label>
    <input id="netease-country" inputMode="numeric" value={countrycode} maxLength={4} disabled={busy} onChange={e => setCountrycode(e.target.value.replace(/\D/g, ''))} />
    <label htmlFor="netease-phone">手机号</label>
    <input id="netease-phone" type="tel" autoComplete="tel-national" value={phone} maxLength={15} disabled={busy} onChange={e => { setPhone(e.target.value.replace(/\D/g, '')); setCaptcha(''); }} />
    <button type="button" disabled={busy || cooldown > 0 || phone.length < 5 || !countrycode} onClick={() => void perform(false)}>{cooldown ? `${cooldown} 秒后重发` : '获取短信验证码'}</button>
    <label htmlFor="netease-sms">短信验证码</label>
    <input id="netease-sms" inputMode="numeric" autoComplete="one-time-code" value={captcha} maxLength={8} disabled={busy} onChange={e => setCaptcha(e.target.value.replace(/\D/g, ''))} />
    {message && <p role="status">{message}</p>}
    <button disabled={busy || phone.length < 5 || captcha.length < 4}>{busy ? '正在处理…' : '登录网易云账号'}</button>
  </form>;
}

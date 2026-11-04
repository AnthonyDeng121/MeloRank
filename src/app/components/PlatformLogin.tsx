import React, { useEffect, useState } from 'react';
import { netease, spotify, type MusicProvider } from '../services/musicPlatforms';
import { qqMusicService } from '../services/qqMusicService';
import { NeteaseCookieLogin } from './NeteaseCookieLogin';

export function PlatformLogin({ provider, onQQ, onDone }: { provider: MusicProvider; onQQ?: (user: { nickname: string }) => void; onDone: () => void }) {
  const [retry, setRetry] = useState(0);
  const [neteaseMethod, setNeteaseMethod] = useState<'qr' | 'cookie'>('qr');
  const [canRetry, setCanRetry] = useState(false);
  const [image, setImage] = useState('');
  const [message, setMessage] = useState('');
  const [clientId, setClientId] = useState(spotify.clientId());
  useEffect(() => {
    if (provider !== 'netease' || neteaseMethod !== 'qr') return;
    const controller = new AbortController();
    setImage(''); setMessage(''); setCanRetry(false);
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        const result = await netease.request('qr', {}, controller.signal);
        if (cancelled) return;
        setImage(result.image); setMessage('请使用网易云音乐 App 扫码');
        const poll = async () => {
          try {
            const status = await netease.request('qr/check', { key: result.key }, controller.signal);
            if (cancelled) return;
            if (status.code === 803 && status.cookie) {
              sessionStorage.setItem('neteaseCookie', status.cookie);
              window.dispatchEvent(new Event('music-auth-change')); onDone(); return;
            }
            if (status.code === 800) { setImage(''); setMessage('二维码已过期，请点击重试'); setCanRetry(true); return; }
            setMessage(status.code === 802 ? '已扫码，请在手机上确认' : '请使用网易云音乐 App 扫码');
            timer = setTimeout(poll, 2500);
          } catch (error) { if (!cancelled) { setMessage((error as Error).message); setCanRetry(true); } }
        };
        timer = setTimeout(poll, 1500);
      } catch (error) { if (!cancelled) { setMessage((error as Error).message); setCanRetry(true); } }
    })();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [provider, retry, neteaseMethod]);
  useEffect(() => {
    if (provider !== 'qq') return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        const qr = await qqMusicService.getLoginQr();
        if (cancelled) return;
        if (!qr.img) throw new Error('获取二维码失败');
        setImage(qr.img);
        const poll = async () => {
          try {
            const response = await qqMusicService.checkLoginStatus(qr);
            if (cancelled) return;
            const status = response.body || response;
            if (status.refresh) { setImage(''); setMessage('二维码已过期，请重新选择平台'); return; }
            if (status.isOk === true && status.cookie) {
              qqMusicService.setCookie(status.cookie);
              onQQ?.({ nickname: status.nickname || 'QQ音乐用户' });
              window.dispatchEvent(new Event('music-auth-change')); onDone(); return;
            }
            timer = setTimeout(poll, 2000);
          } catch (error) { if (!cancelled) setMessage((error as Error).message); }
        };
        timer = setTimeout(poll, 1500);
      } catch (error) { if (!cancelled) setMessage((error as Error).message); }
    })();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [provider]);
  return <div className="modal-content">
    {provider === 'netease' && <div className="netease-login-methods" aria-label="网易云登录方式">
      <button type="button" aria-pressed={neteaseMethod === 'qr'} onClick={() => setNeteaseMethod('qr')}>App 扫码</button>
      <button type="button" aria-pressed={neteaseMethod === 'cookie'} onClick={() => setNeteaseMethod('cookie')}>官网登录凭证</button>
    </div>}
    {provider === 'netease' && neteaseMethod === 'cookie' ? <NeteaseCookieLogin onDone={onDone} /> : <>
    {provider === 'spotify' ? <div className="spotify-config"><label htmlFor="login-client-id">Spotify Client ID</label><input id="login-client-id" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="开发者应用的 Client ID" /><p>回调地址：<code>{spotify.redirectUri()}</code></p><button onClick={() => spotify.begin(clientId.trim()).catch(error => setMessage(error.message))}>前往 Spotify 授权</button></div> : <><p>{message || (provider === 'qq' ? '请使用手机 QQ 扫码登录' : '正在获取二维码…')}</p>{image && <div className="qr-code-container"><img className="qr-code" src={image} alt="登录二维码" /></div>}</>}
    {provider === 'netease' && canRetry && <button type="button" onClick={() => setRetry(value => value + 1)}>重新获取二维码</button>}
    {provider === 'spotify' && message && <p role="alert">{message}</p>}
    </>}
  </div>;
}

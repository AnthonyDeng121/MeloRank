import React, { useEffect, useState } from 'react';
import { netease, spotify, type MusicProvider } from '../services/musicPlatforms';
import { qqMusicService } from '../services/qqMusicService';

export function PlatformLogin({ provider, onQQ, onDone }: { provider: MusicProvider; onQQ?: (user: { nickname: string }) => void; onDone: () => void }) {
  const [image, setImage] = useState('');
  const [message, setMessage] = useState('');
  const [clientId, setClientId] = useState(spotify.clientId());
  useEffect(() => {
    if (provider !== 'netease') return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        const result = await netease.request('qr');
        if (cancelled) return;
        setImage(result.image); setMessage('请使用网易云音乐 App 扫码');
        const poll = async () => {
          try {
            const status = await netease.request('qr/check', { key: result.key });
            if (cancelled) return;
            if (status.code === 803 && status.cookie) {
              sessionStorage.setItem('neteaseCookie', status.cookie);
              window.dispatchEvent(new Event('music-auth-change')); onDone(); return;
            }
            if (status.code === 800) { setImage(''); setMessage('二维码已过期，请重新选择网易云'); return; }
            setMessage(status.code === 802 ? '已扫码，请在手机上确认' : '请使用网易云音乐 App 扫码');
            timer = setTimeout(poll, 2500);
          } catch (error) { if (!cancelled) setMessage((error as Error).message); }
        };
        timer = setTimeout(poll, 1500);
      } catch (error) { if (!cancelled) setMessage((error as Error).message); }
    })();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [provider]);
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
    {provider === 'spotify' ? <div className="spotify-config"><label htmlFor="login-client-id">Spotify Client ID</label><input id="login-client-id" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="开发者应用的 Client ID" /><p>回调地址：<code>{spotify.redirectUri()}</code></p><button onClick={() => spotify.begin(clientId.trim()).catch(error => setMessage(error.message))}>前往 Spotify 授权</button></div> : <><p>{message || (provider === 'qq' ? '请使用手机 QQ 扫码登录' : '正在获取二维码…')}</p>{image && <div className="qr-code-container"><img className="qr-code" src={image} alt="登录二维码" /></div>}</>}
    {provider === 'spotify' && message && <p role="alert">{message}</p>}
  </div>;
}

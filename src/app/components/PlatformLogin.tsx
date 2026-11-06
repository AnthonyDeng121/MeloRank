import React, { useEffect, useState } from 'react';
import { netease, spotify, type MusicProvider } from '../services/musicPlatforms';
import { qqMusicService } from '../services/qqMusicService';
import { usePlatformAccounts } from '../contexts/PlatformAccountsContext';

export function PlatformLogin({ provider, onQQ, onDone }: { provider: MusicProvider; onQQ?: (user: { nickname: string }) => void; onDone: () => void }) {
  const { accounts } = usePlatformAccounts();
  const connected = accounts[provider].connected;
  const [image, setImage] = useState(''), [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0), [failed, setFailed] = useState(false);
  const [clientId, setClientId] = useState(spotify.clientId());
  useEffect(() => {
    if (connected || provider === 'spotify') return;
    const controller = new AbortController();
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    setImage(''); setMessage('正在获取二维码…'); setFailed(false);
    (async () => {
      try {
        const qr = provider === 'netease' ? await netease.request('go/qr', {}, controller.signal) : await qqMusicService.getLoginQr();
        if (cancelled) return;
        if (!(qr.image || qr.img)) throw new Error('未获得二维码，请重试');
        setImage(qr.image || qr.img); setMessage(provider === 'netease' ? '请使用网易云音乐 App 扫码' : '请使用手机 QQ 扫码登录');
        const poll = async () => {
          try {
            const response = provider === 'netease' ? await netease.request('go/qr/check', { key: qr.key }, controller.signal) : await qqMusicService.checkLoginStatus(qr);
            if (cancelled) return;
            const status = response.body || response;
            if (status.code === 800 || status.refresh) { setImage(''); setMessage('二维码已过期，请重新获取'); setFailed(true); return; }
            if (provider === 'netease' ? status.code === 803 && status.cookie : status.isOk && status.cookie) {
              if (provider === 'netease') {
                sessionStorage.setItem('neteaseCookie', status.cookie);
                sessionStorage.setItem('melorankAccount:netease', status.profile?.nickname || '网易云音乐用户');
              } else { qqMusicService.setCookie(status.cookie); const nickname = status.nickname || 'QQ 音乐用户'; localStorage.setItem('qqMusicNickname', nickname); onQQ?.({ nickname }); }
              window.dispatchEvent(new Event('music-auth-change')); onDone(); return;
            }
            if (status.code === 802) setMessage('已扫码，请在手机上确认');
            timer = setTimeout(poll, 2500);
          } catch (error) { if (!cancelled) { setMessage((error as Error).message); setFailed(true); } }
        };
        timer = setTimeout(poll, 1500);
      } catch (error) { if (!cancelled) { setMessage((error as Error).message); setFailed(true); } }
    })();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [provider, retry, connected]);
  if (connected) return <div className="platform-connected"><span className="connected-check">✓</span><h4>已登录该平台账号</h4><p>{accounts[provider].nickname}</p><button onClick={() => { onDone(); }}>完成</button>{provider === 'spotify' && !spotify.playbackAuthorized() && <><p>当前授权未包含站内播放权限。</p><button onClick={() => void spotify.begin(spotify.clientId()).catch(error => setMessage(error.message))}>更新播放授权</button>{message && <p role="alert">{message}</p>}</>}</div>;
  return <div className="modal-content">{provider === 'spotify' ? <div className="spotify-config"><label htmlFor="login-client-id">Spotify Client ID</label><input id="login-client-id" value={clientId} onChange={event => setClientId(event.target.value)} placeholder="开发者应用的 Client ID" /><p>回调地址：<code>{spotify.redirectUri()}</code></p><p>站内播放需要 Spotify Premium 和播放授权。</p><button onClick={() => spotify.begin(clientId.trim()).catch(error => setMessage(error.message))}>前往 Spotify 授权</button>{message && <p role="alert">{message}</p>}</div> : <><p role={failed ? 'alert' : 'status'}>{message}</p>{image && <div className="qr-code-container"><img className="qr-code" src={image} alt="登录二维码" /></div>}{failed && <button onClick={() => setRetry(value => value + 1)}>重新获取二维码</button>}</>}</div>;
}

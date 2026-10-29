import React, { useEffect, useRef, useState } from 'react';
import { qqMusicService } from '../services/qqMusicService';
import { QQ_MUSIC_CONFIG } from '../services/qqMusicConfig';
import { netease, spotify, type MusicProvider, type LibraryKind, type LibraryItem } from '../services/musicPlatforms';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/MusicLibrary.css';

export function MusicLibrary() {
  const [provider, setProvider] = useState<MusicProvider>(() => /[?&](code|connectSpotify|error)=/.test(location.search) ? 'spotify' : 'qq');
  const [kind, setKind] = useState<LibraryKind>('playlists');
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [clientId, setClientId] = useState(spotify.clientId());
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<{ key: string; image: string } | null>(null);
  const [qrStatus, setQrStatus] = useState('');
  const generation = useRef(0);
  const { setCurrentSong } = useMusic();
  const refreshAccount = async (selected: MusicProvider) => {
    if (selected === 'qq') {
      if (!qqMusicService.isLoggedIn()) return { connected: false, account: '' };
      const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/account`, { headers: { 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, credentials: 'omit' });
      if (!response.ok) throw new Error('QQ 登录状态不可用，请重新登录');
      return { connected: true, account: localStorage.getItem('qqMusicNickname') || 'QQ 音乐用户' };
    }
    if (selected === 'netease') {
      if (!netease.cookie()) return { connected: false, account: '' };
      const profile = await netease.request('account');
      return { connected: true, account: profile.nickname || '网易云音乐用户' };
    }
    await spotify.finish();
    if (!spotify.connected()) return { connected: false, account: '' };
    const profile = await spotify.request('/me');
    return { connected: true, account: profile.display_name || 'Spotify 用户' };
  };
  useEffect(() => {
    const id = ++generation.current;
    setItems([]); setOffset(0); setMore(false); setError(''); setQr(null); setConnected(false); setBusy(true);
    refreshAccount(provider).then(result => { if (id === generation.current) { setConnected(result.connected); setAccount(result.account); } }).catch(reason => { if (id === generation.current) setError(reason.message); }).finally(() => { if (id === generation.current) setBusy(false); });
    return () => { generation.current++; };
  }, [provider]);
  const load = async (start = 0) => {
    const id = ++generation.current;
    setBusy(true); setError('');
    try {
      let result;
      if (provider === 'qq') {
        const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/library?kind=${kind}&offset=${start}`, { headers: { 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, credentials: 'omit', signal: AbortSignal.timeout(25000) });
        result = await response.json(); if (!response.ok) throw new Error(result.error || 'QQ 曲库加载失败');
      } else result = provider === 'netease' ? await netease.request('library', { kind, offset: start }) : await spotify.library(kind, start);
      if (id !== generation.current) return;
      setItems(previous => start === 0 ? result.items : [...previous, ...result.items]); setMore(result.hasMore); setOffset(start + 30);
    } catch (reason) { if (id === generation.current) setError(reason instanceof Error ? reason.message : '曲库加载失败'); }
    finally { if (id === generation.current) setBusy(false); }
  };
  useEffect(() => { setItems([]); setMore(false); setOffset(0); if (connected) void load(); }, [provider, kind, connected]);
  useEffect(() => {
    if (!qr || provider !== 'netease') return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await netease.request('qr/check', { key: qr.key });
        if (cancelled) return;
        if (result.code === 803 && result.cookie) {
          sessionStorage.setItem('neteaseCookie', result.cookie); setQr(null); setAccount(result.profile.nickname); setConnected(true); return;
        }
        if (result.code === 800) { setQr(null); setError('二维码已过期，请重新获取'); return; }
        setQrStatus(result.code === 802 ? '已扫码，请在手机上确认' : '请使用网易云音乐 App 扫码');
      } catch (reason) { if (!cancelled) { setQr(null); setError(reason instanceof Error ? reason.message : '扫码状态读取失败'); return; } }
      if (!cancelled) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 1500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [qr, provider]);
  const connect = async () => {
    setBusy(true); setError('');
    try {
      if (provider === 'spotify') await spotify.begin(clientId.trim());
      else if (provider === 'netease') { setQr(await netease.request('qr')); setQrStatus('请使用网易云音乐 App 扫码'); }
      else document.getElementById('qq-music-login-btn')?.click();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '登录失败'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    const changed = () => { if (provider === 'qq') { generation.current++; setConnected(qqMusicService.isLoggedIn()); setItems([]); setAccount(localStorage.getItem('qqMusicNickname') || 'QQ 音乐用户'); } };
    window.addEventListener('qqmusic-auth-change', changed);
    return () => window.removeEventListener('qqmusic-auth-change', changed);
  }, [provider]);
  const disconnect = async () => {
    generation.current++; setConnected(false); setItems([]); setMore(false); setBusy(false); setQr(null); setAccount(''); setError('');
    if (provider === 'spotify') spotify.logout(); else if (provider === 'netease') await netease.logout(); else qqMusicService.logout();
  };
  return <div className="music-library-page">
    <header><div><h2>我的音乐</h2><p>连接音乐账号，查看你的歌单、喜欢的歌曲和收藏专辑</p></div>{connected && <div className="library-account"><span>{account}</span><button onClick={disconnect}>断开连接</button></div>}</header>
    <div className="library-providers" role="tablist" aria-label="音乐平台">{(['qq', 'netease', 'spotify'] as MusicProvider[]).map(value => <button key={value} role="tab" aria-selected={provider === value} onClick={() => { if (value === provider) return; generation.current++; setConnected(false); setItems([]); setProvider(value); }}>{value === 'qq' ? 'QQ 音乐' : value === 'netease' ? '网易云音乐' : 'Spotify'}</button>)}</div>
    {!connected && <section className="library-connect"><h3>连接{provider === 'qq' ? ' QQ 音乐' : provider === 'netease' ? '网易云音乐' : ' Spotify'}</h3>{provider === 'spotify' && <div className="spotify-config"><label htmlFor="spotify-client-id">Client ID</label><input id="spotify-client-id" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Spotify 开发者应用的 Client ID" /><p>将回调地址 <code>{spotify.redirectUri()}</code> 添加到 Spotify 应用后台。通过官方页面授权，无需提供 Client Secret。</p>{location.hostname === 'localhost' && <p>登录时会切换到 127.0.0.1，以符合 Spotify 回调地址要求。</p>}</div>}{qr ? <div className="library-qr"><img src={qr.image} alt="网易云音乐登录二维码" /><p role="status">{qrStatus}</p><button onClick={() => setQr(null)}>取消扫码</button></div> : <button className="library-connect-button" disabled={busy} onClick={connect}>{busy ? '正在连接…' : provider === 'netease' ? '扫码登录网易云' : provider === 'spotify' ? '前往 Spotify 授权' : '登录 QQ 音乐'}</button>}</section>}
    {connected && <><div className="library-kinds" role="tablist" aria-label="曲库分类">{([['playlists', provider === 'spotify' ? '我的歌单' : '我创建的歌单'], ['liked', '喜欢的歌曲'], ['albums', '收藏专辑']] as [LibraryKind, string][]).map(([value, label]) => <button key={value} role="tab" aria-selected={kind === value} onClick={() => setKind(value)}>{label}</button>)}<button className="library-refresh" disabled={busy} onClick={() => load()}>刷新</button></div><div className="library-grid">{items.map((item, i) => <article key={`${item.id}-${i}`}><div className="library-cover">{item.image ? <img src={item.image.replace(/^http:/, 'https:')} alt="" loading="lazy" /> : <span>♪</span>}</div><h3>{item.title}</h3><p>{item.subtitle}</p><div>{item.qqSong && <button onClick={() => setCurrentSong(item.qqSong)}>播放</button>}{/^https:\/\//.test(item.externalUrl) && <a href={item.externalUrl} target="_blank" rel="noreferrer">在平台打开</a>}</div></article>)}</div>{!busy && !error && !items.length && <p className="library-empty">此分类暂无内容</p>}{more && <button className="library-load-more" disabled={busy} onClick={() => load(offset)}>加载更多</button>}</>}
    {busy && <p role="status">正在读取音乐账号…</p>}{error && <p className="library-error" role="alert">{error}</p>}
  </div>;
}

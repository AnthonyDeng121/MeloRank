import React, { useCallback, useEffect, useState } from 'react';
import { usePlatformAccounts } from '../contexts/PlatformAccountsContext';
import { useMusic } from '../contexts/MusicContext';
import { netease, type MusicProvider } from '../services/musicPlatforms';
export interface MVItem { provider: MusicProvider; id: string; title: string; artist: string; image: string; duration: number }
async function request(provider: MusicProvider, action: string, body: object) {
  if (provider === 'spotify') throw new Error('Spotify 暂不支持 MV，请切换 QQ 音乐或网易云音乐');
  const base = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
  const response = await fetch(`${base}/api/mv/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': netease.cookie(), 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, body: JSON.stringify({ provider, ...body }), signal: AbortSignal.timeout(25000) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'MV 请求失败'); return data;
}
export async function searchMVs(provider: MusicProvider, query: string, page: number) {
  const data = await request(provider, 'search', { query, page });
  return { items: data.items.map((item: MVItem) => ({ ...item, provider })), total: data.total };
}
export function MVPlayer({ item }: { item: MVItem }) {
  const { activeProvider } = usePlatformAccounts();
  const { isPlaying, togglePlay } = useMusic();
  const [audioOnly, setAudioOnly] = useState(false), [url, setUrl] = useState(''), [description, setDescription] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setUrl(''); setError('');
    if (activeProvider !== item.provider) { setError('平台已切换，请在当前平台重新选择 MV'); return; }
    request(item.provider, 'play', { id: item.id }).then(data => { if (active) { setUrl(data.url); setDescription(data.description || ''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [item.provider, item.id, retry, activeProvider]);
  const initializeMedia = useCallback((media: HTMLMediaElement | null) => { if (media) { media.volume = 0.2; media.autoplay = false; } }, []);
  const pauseSong = () => { if (isPlaying) togglePlay(); };
  const fail = () => setError('MV 暂时无法播放，请重试或检查账号播放权限');
  return <section className="mv-player-panel"><header><div><small>MV · {item.provider === 'qq' ? 'QQ 音乐' : '网易云音乐'}</small><h2>{item.title}</h2><p>{item.artist}</p></div><button className="work-review-entry" aria-pressed={audioOnly} onClick={() => setAudioOnly(value => !value)}>{audioOnly ? '观看画面' : '仅听声音'}</button></header><div className="mv-player-stage">{!url && !error && <p role="status">正在加载 MV…</p>}{url && (audioOnly ? <div className="mv-audio-stage">{item.image && <img src={item.image} alt="MV 封面" />}<audio src={url} controls ref={initializeMedia} preload="metadata" onPlay={pauseSong} onError={fail} /></div> : <video src={url} poster={item.image} controls ref={initializeMedia} preload="metadata" playsInline onPlay={pauseSong} onError={fail} />)}</div>{error && <p className="library-error" role="alert">{error} <button className="work-review-entry" onClick={() => setRetry(value => value + 1)}>重试</button></p>}{description && <details className="catalog-description"><summary>MV 简介</summary><p>{description}</p></details>}</section>;
}

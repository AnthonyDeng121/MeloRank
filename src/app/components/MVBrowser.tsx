import { searchPlatform, type PlatformSong } from '../services/platformSongs';
import { uniqueMVMatch } from '../services/mvMatching';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
export function MVPlayer({ item, onSong }: { item: MVItem; onSong?: () => void }) {
  const { activeProvider } = usePlatformAccounts();
  const { isPlaying, togglePlay, setCurrentSong } = useMusic();
  const [loop, setLoop] = useState(false);
  const [songs, setSongs] = useState<PlatformSong[]>([]);
  const [songBusy, setSongBusy] = useState(false);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const songVersion = useRef(0);
  const [audioOnly, setAudioOnly] = useState(false), [url, setUrl] = useState(''), [description, setDescription] = useState(''), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [songError, setSongError] = useState('');
  useEffect(() => {
    let active = true; songVersion.current++; setSongs([]); setSongError(''); setSongBusy(false); setDescription(''); setUrl(''); setError('');
    if (activeProvider !== item.provider) { return; }
    request(item.provider, 'play', { id: item.id }).then(data => { if (active) { setUrl(data.url); setDescription(data.description || ''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; songVersion.current++; mediaRef.current?.pause(); mediaRef.current?.removeAttribute('src'); };
  }, [item.provider, item.id, retry, activeProvider]);
  const initializeMedia = useCallback((media: HTMLMediaElement | null) => { mediaRef.current = media; if (media) { media.volume = 0.2; media.autoplay = false; } }, []);
  const findSong = async () => {
    const version = ++songVersion.current;
    setSongBusy(true); setSongs([]); setSongError('');
    try {
      const title = item.title.replace(/official\s*(music\s*)?video|music\s*video|\bMV\b|\bM\/V\b/gi, '').trim();
      const result = await searchPlatform(item.provider, `${title} ${item.artist}`, 10, 1);
      if (version !== songVersion.current) return;
      const values = result.response?.data?.song?.list || [];
      const exact = uniqueMVMatch<PlatformSong>(values, title, item.artist, song => ({ title: song.songname, artist: song.singer.map(artist => artist.name).join(' / ') }));
      if (exact) { mediaRef.current?.pause(); setCurrentSong(exact); onSong?.(); }
      else setSongs(values);
      if (!values.length) setSongError('未找到对应歌曲，请尝试在搜索页查找');
    } catch (error) { if (version === songVersion.current) setSongError(error instanceof Error ? error.message : '歌曲查找失败'); }
    finally { if (version === songVersion.current) setSongBusy(false); }
  };
  if (activeProvider !== item.provider) return null;
  const pauseSong = () => { if (isPlaying) togglePlay(); };
  const fail = () => setError('MV 暂时无法播放，请重试或检查账号播放权限');
  return <section className="mv-player-panel"><header><div><small>MV · {item.provider === 'qq' ? 'QQ 音乐' : '网易云音乐'}</small><h2>{item.title}</h2><p>{item.artist}</p></div><div className="mv-playback-actions"><button className="work-review-entry" disabled={songBusy} data-disabled-reason="正在查找歌曲" onClick={() => void findSong()}>{songBusy ? '查找中…' : '对应歌曲'}</button><button className="work-review-entry" aria-pressed={loop} onClick={() => setLoop(value => !value)}>{loop ? '单曲 MV 循环：开' : '单曲 MV 循环：关'}</button><button className="work-review-entry" aria-pressed={audioOnly} onClick={() => setAudioOnly(value => !value)}>{audioOnly ? '观看画面' : '仅听声音'}</button></div></header>{songError && <p role="status">{songError}</p>}{songs.length > 0 && <div className="mv-link-results"><p>选择对应音源</p>{songs.map(song => <button key={song.songmid} onClick={() => { mediaRef.current?.pause(); setCurrentSong(song); onSong?.(); }}>{song.songname} · {song.singer.map(artist => artist.name).join(' / ')}</button>)}</div>}<div className="mv-player-stage">{!url && !error && <p role="status">正在加载 MV…</p>}{url && (audioOnly ? <div className="mv-audio-stage">{item.image && <img src={item.image} alt="MV 封面" />}<audio src={url} controls loop={loop} ref={initializeMedia} preload="metadata" onPlay={pauseSong} onError={fail} /></div> : <video src={url} poster={item.image} controls loop={loop} ref={initializeMedia} preload="metadata" playsInline onPlay={pauseSong} onError={fail} />)}</div>{error && <p className="library-error" role="alert">{error} <button className="work-review-entry" onClick={() => setRetry(value => value + 1)}>重试</button></p>}{description && <details className="catalog-description"><summary>MV 简介</summary><p>{description}</p></details>}</section>;
}

import React, { useEffect, useState, useRef } from 'react';
import { usePlatformAccounts } from '../contexts/PlatformAccountsContext';
import { useMusic } from '../contexts/MusicContext';
import { netease } from '../services/musicPlatforms';
interface MV { id: string; title: string; artist: string; image: string; duration: number }
export function MVBrowser({ initialQuery = '' }: { initialQuery?: string }) {
  const generation = useRef(0);
  const submittedQuery = useRef(initialQuery);
  const [audioOnly, setAudioOnly] = useState(false);
  const { activeProvider } = usePlatformAccounts();
  const { isPlaying, togglePlay } = useMusic();
  const [query, setQuery] = useState(initialQuery), [items, setItems] = useState<MV[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [selected, setSelected] = useState<(MV & { url: string; description?: string }) | null>(null);
  useEffect(() => { generation.current++; setBusy(false); setItems([]); setTotal(0); setPage(1); setSelected(null); setError(''); return () => { generation.current++; }; }, [activeProvider]);
  const request = async (action: string, body: object) => {
    const base = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
    const response = await fetch(`${base}/api/mv/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': netease.cookie(), 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, body: JSON.stringify({ provider: activeProvider, ...body }), signal: AbortSignal.timeout(25000) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'MV 请求失败'); return data;
  };
  const search = async (next = 1) => { const token = ++generation.current; setBusy(true); setError(''); setSelected(null); try { if (next === 1) submittedQuery.current = query; const data = await request('search', { query: submittedQuery.current, page: next }); if (token !== generation.current) return; setItems(data.items); setTotal(data.total); setPage(next); } catch (e) { if (token === generation.current) setError((e as Error).message); } finally { if (token === generation.current) setBusy(false); } };
  const play = async (mv: MV) => { const token = ++generation.current; setBusy(true); setError(''); setSelected(null); try { const data = await request('play', { id: mv.id }); if (token !== generation.current) return; if (isPlaying) togglePlay(); setSelected({ ...mv, ...data }); } catch (e) { if (token === generation.current) setError((e as Error).message); } finally { if (token === generation.current) setBusy(false); } };
  if (activeProvider === 'spotify') return <p>Spotify 暂不支持 MV，请切换 QQ 音乐或网易云音乐。</p>;
  return <section className="mv-browser"><form onSubmit={e => { e.preventDefault(); void search(); }}><input aria-label="搜索 MV" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索 MV 名称或歌手" /><button disabled={busy || !query.trim()}>搜索 MV</button></form>{busy && <p role="status">正在加载 MV…</p>}{error && <p role="alert">{error}</p>}{selected && <article><h3>{selected.title}</h3><p>{selected.artist}</p><button type="button" aria-pressed={audioOnly} onClick={() => setAudioOnly(value => !value)}>{audioOnly ? '观看画面' : '仅听声音'}</button>{audioOnly ? <audio src={selected.url} controls autoPlay onPlay={() => { if (isPlaying) togglePlay(); }} /> : <video key={selected.url} src={selected.url} poster={selected.image} controls autoPlay playsInline onPlay={() => { if (isPlaying) togglePlay(); }} onError={() => setError('视频暂时无法播放，可能链接已失效或没有播放权限')} />}{selected.description && <p>{selected.description}</p>}</article>}<div>{items.map(mv => <button className="catalog-search-result" key={mv.id} disabled={busy} onClick={() => void play(mv)}>{mv.image && <img src={mv.image} alt="" />}<span><strong>{mv.title}</strong><small>{mv.artist}</small></span><span>播放 MV →</span></button>)}</div>{total > 0 && <nav className="catalog-pagination"><button disabled={busy || page <= 1} onClick={() => void search(page - 1)}>上一页</button><span>第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span><button disabled={busy || page * 20 >= total} onClick={() => void search(page + 1)}>下一页</button></nav>}</section>;
}

import React, { useEffect, useState } from 'react';
import { getCatalogDetail, type CatalogDetail, type CatalogItem } from '../services/catalog';
import { useMusic } from '../contexts/MusicContext';
import { WorkReview } from './WorkReview';

export function CatalogPanel({ item }: { item: CatalogItem }) {
  const [detail, setDetail] = useState<CatalogDetail | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  const { currentSong, isPlaying, setCurrentSong, togglePlay } = useMusic();
  useEffect(() => {
    let active = true; setDetail(null); setError(''); setLoading(true);
    getCatalogDetail(item).then(data => { if (active) setDetail(data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item.provider, item.kind, item.id, retry]);
  const loadMore = async () => {
    if (!detail || loading) return;
    setLoading(true); setError('');
    try { const next = await getCatalogDetail(item, detail.songs.length); setDetail({ ...next, songs: [...detail.songs, ...next.songs] }); }
    catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  const info = detail?.item || item;
  return <section className="catalog-panel">
    <div className="catalog-heading">{info.image ? <img src={info.image} alt={`${info.title}封面`} /> : <div className="catalog-placeholder">♫</div>}<div><p className="muted">{item.kind === 'albums' ? '专辑' : '歌手'}</p><h1>{info.title}</h1><p>{info.artist}</p>{info.date && <p>{info.date}</p>}{info.total !== undefined && <p className="muted">{info.total} 首歌曲</p>}<div className="catalog-actions"><button disabled={!detail?.songs.length} data-disabled-reason={loading ? '正在读取曲目，请稍候' : '暂无可播放的曲目'} onClick={() => detail && setCurrentSong(detail.songs[0], detail.songs)}>播放全部</button>{item.kind === 'albums' && detail && !detail.hasMore && <WorkReview key={`${item.provider}:${item.id}`} id={`${item.provider}:album:${item.id}`} title={info.title} artist={info.artist} image={info.image} songs={detail.songs} />}</div></div></div>
    {info.description && <details className="catalog-description"><summary>{item.kind === 'albums' ? '专辑介绍' : '歌手介绍'}</summary><p>{info.description.replace(/<[^>]*>/g, '')}</p></details>}
    {error && <p className="library-error" role="alert">{error} <button onClick={() => detail ? void loadMore() : setRetry(v => v + 1)}>重试</button></p>}
    <p className="catalog-list-caption muted">{item.kind === 'albums' ? '歌曲总览' : '热门歌曲'} · 已加载 {detail?.songs.length || 0} 首</p>
    <div className="catalog-track-list"><div className="catalog-track-row muted"><span>#</span><span>歌曲 / 歌手</span><span>专辑</span><span>时长</span></div>{detail?.songs.map((song, i) => <button className={`catalog-track-row ${currentSong?.songmid === song.songmid ? 'current' : ''}`} key={`${song.songmid}:${i}`} onClick={() => currentSong?.songmid === song.songmid ? togglePlay() : setCurrentSong(song, detail.songs)}><span>{currentSong?.songmid === song.songmid && isPlaying ? 'Ⅱ' : String(i + 1).padStart(2, '0')}</span><span><strong>{song.songname}</strong><small>{song.singer.map(s => s.name).join(' / ')}</small></span><span>{song.albumname}</span><span>{song.duration ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : '—'}</span></button>)}</div>
    {loading && <p role="status">正在读取曲目…</p>}{detail?.hasMore && <button disabled={loading} data-disabled-reason="正在读取下一页曲目" onClick={loadMore}>加载更多曲目</button>}{detail && !detail.songs.length && <p>平台暂无可用曲目</p>}
  </section>;
}

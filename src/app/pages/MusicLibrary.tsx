import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Pause, Music2, RefreshCw } from 'lucide-react';
import { QQ_MUSIC_CONFIG } from '../services/qqMusicConfig';
import { netease, spotify, type MusicProvider, type LibraryKind, type LibraryItem } from '../services/musicPlatforms';
import { neteaseSong, spotifySong, songCover, type PlatformSong } from '../services/platformSongs';
import { platformList, platformNames, usePlatformAccounts } from '../contexts/PlatformAccountsContext';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/MusicLibrary.css';
import { PlaylistEditor } from '../components/PlaylistEditor';

export function MusicLibrary({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { accounts, activeProvider, disconnect } = usePlatformAccounts();
  const [provider, setProvider] = useState<MusicProvider>(activeProvider);
  const account = accounts[provider], connected = account.connected;
  const { currentSong, isPlaying, setCurrentSong, togglePlay } = useMusic();
  const [kind, setKind] = useState<LibraryKind>('playlists');
  const [items, setItems] = useState<LibraryItem[]>([]), [tracks, setTracks] = useState<LibraryItem[]>([]);
  const [collection, setCollection] = useState<LibraryItem | null>(null);
  const [busy, setBusy] = useState(false), [collectionBusy, setCollectionBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [collectionError, setCollectionError] = useState('');
  const [query, setQuery] = useState(''), [page, setPage] = useState(1), [trackPage, setTrackPage] = useState(1);
  const pageSize = 12;
  const [revision, setRevision] = useState(0);
  const generation = useRef(0), collectionGeneration = useRef(0);
  useEffect(() => { const changed = () => setRevision(value => value + 1); window.addEventListener('music-auth-change', changed); window.addEventListener('qqmusic-auth-change', changed); return () => { window.removeEventListener('music-auth-change', changed); window.removeEventListener('qqmusic-auth-change', changed); }; }, []);
  const qq = async (query: string) => {
    const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/library?${query}`, { headers: { 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, credentials: 'omit', signal: AbortSignal.timeout(25000) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '曲库读取失败'); return data;
  };
  const asSong = (item: LibraryItem): PlatformSong | null => item.qqSong ? { ...item.qqSong, albumId: item.qqSong.albumid || item.qqSong.albummid, provider: 'qq' } : item.neteaseTrack ? neteaseSong(item.neteaseTrack) : item.spotifyTrack ? spotifySong(item.spotifyTrack) : null;
  const matches = (item: LibraryItem) => [item.title, item.subtitle, asSong(item)?.albumname].filter(Boolean).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const filteredItems = items.filter(matches), filteredTracks = tracks.filter(matches);
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const visibleTracks = filteredTracks.slice((trackPage - 1) * pageSize, trackPage * pageSize);
  const pagination = (count: number, current: number, change: (value: number) => void) => <nav className="library-pagination" aria-label="内容分页"><button disabled={current <= 1 || busy || collectionBusy} data-disabled-reason={current <= 1 ? '已经是第一页' : '正在读取曲库，请稍候'} onClick={() => change(current - 1)}>上一页</button><span>第 {current} / {Math.max(1, Math.ceil(count / pageSize))} 页 · 共 {count} 项</span><button disabled={current * pageSize >= count || busy || collectionBusy} data-disabled-reason={current * pageSize >= count ? '已经是最后一页' : '正在读取曲库，请稍候'} onClick={() => change(current + 1)}>下一页</button></nav>;
  const playItem = (item: LibraryItem, source: LibraryItem[]) => {
    const song = asSong(item); if (!song) return;
    if (currentSong?.songmid === song.songmid) togglePlay();
    else setCurrentSong(song, source.map(asSong).filter((value): value is PlatformSong => !!value));
  };
  const load = async (start = 0) => {
    const ticket = ++generation.current; setBusy(true); setError('');
    try {
      const all: LibraryItem[] = []; let cursor = start;
      while (true) {
        const result = provider === 'qq' ? await qq(`kind=${kind}&offset=${cursor}`) : provider === 'netease' ? await netease.request('library', { kind, offset: cursor }) : await spotify.library(kind, cursor);
        if (ticket !== generation.current) return;
        all.push(...result.items);
        const next = result.nextOffset ?? cursor + result.items.length;
        if (!result.hasMore || !result.items.length || next <= cursor) break;
        cursor = next;
      }
      setItems(all); setPage(1);
    } catch (reason) { if (ticket === generation.current) setError((reason as Error).message); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  useEffect(() => {
    generation.current++; collectionGeneration.current++; setQuery(''); setPage(1); setTrackPage(1); setCollection(null); setTracks([]); setItems([]); setError(''); setBusy(false); setCollectionBusy(false); setSaving(false);
    if (connected) void load();
    return () => { generation.current++; collectionGeneration.current++; };
  }, [provider, kind, connected, revision]);
  const readCollection = async (item: LibraryItem, offset: number) => {
    if (provider === 'qq') return qq(`kind=collection&type=${kind}&id=${encodeURIComponent(item.id)}&offset=${offset}`);
    if (provider === 'netease') return netease.request('collection', { kind, id: item.id, offset });
    const data = await spotify.request(kind === 'albums' ? `/albums/${item.id}/tracks?limit=30&offset=${offset}` : `/playlists/${item.id}/tracks?limit=30&offset=${offset}`);
    return { hasMore: !!data.next, nextOffset: offset + (data.items || []).length, items: (data.items || []).map((entry: any) => {
      const track = entry?.track || entry;
      if (!track?.id) return null;
      return { id: track.id, title: track.name, subtitle: (track.artists || []).map((artist: any) => artist.name).join(' / '), image: track.album?.images?.[0]?.url || item.image, spotifyTrack: { ...track, album: track.album || { name: item.title, images: [{ url: item.image }] } } };
    }).filter(Boolean) };
  };
  const openCollection = async (item: LibraryItem, offset = 0) => {
    const ticket = ++collectionGeneration.current; setCollection(item); setCollectionError(''); setCollectionBusy(true);
    if (!offset) { setTracks([]); }
    try {
      const all: LibraryItem[] = []; let cursor = offset, updated = item;
      while (true) {
        const result = await readCollection(item, cursor);
        if (ticket !== collectionGeneration.current) return;
        if (result.metadata?.title) updated = { ...updated, title: result.metadata.title, image: result.metadata.image || updated.image };
        all.push(...result.items);
        const next = result.nextOffset ?? cursor + result.items.length;
        if (!result.hasMore || !result.items.length || next <= cursor) break;
        cursor = next;
      }
      setTracks(all); setTrackPage(1); setQuery('');
      if (kind === 'playlists' && provider !== 'spotify') {
        updated = { ...updated, subtitle: `${all.length} 首` };
        setCollection(updated); setItems(previous => previous.map(value => value.id === item.id ? updated : value));
      }
    } catch (reason) { if (ticket === collectionGeneration.current) setCollectionError((reason as Error).message); }
    finally { if (ticket === collectionGeneration.current) setCollectionBusy(false); }
  };
  const playAll = () => {
    if (collectionBusy) return;
    const queue = tracks.map(asSong).filter((song): song is PlatformSong => !!song);
    if (queue[0]) setCurrentSong(queue[0], queue);
  };
  const playing = (item: LibraryItem) => { const song = asSong(item); return !!song && song.songmid === currentSong?.songmid && isPlaying; };
  return <div className="music-library-page">
    <header><div><h2>我的音乐</h2><p>连接音乐账号，查看你的歌单、喜欢的歌曲和收藏专辑</p></div>{connected && <div className="library-account"><span>{account.nickname}</span><button disabled={saving} data-disabled-reason={'正在同步歌单修改，请稍候'} onClick={() => void disconnect(provider)}>断开连接</button></div>}</header>
    <div className="library-providers" role="tablist" aria-label="音乐平台">{platformList.map(value => <button key={value} role="tab" disabled={saving} data-disabled-reason={'正在同步歌单修改，请稍候'} aria-selected={provider === value} onClick={() => setProvider(value)}>{platformNames[value]}</button>)}</div>
    {!connected && <section className="library-connect"><h3>连接{platformNames[provider]}</h3><button className="library-connect-button" onClick={() => window.dispatchEvent(new CustomEvent('music-login', { detail: provider }))}>登录</button></section>}
    {connected && !collection && <>
      <div className="library-kinds" role="tablist" aria-label="曲库分类">{([['playlists', provider === 'spotify' ? '我的歌单' : '我创建的歌单'], ['liked', '喜欢的歌曲'], ['albums', '收藏专辑']] as [LibraryKind, string][]).map(([value, label]) => <button key={value} role="tab" aria-selected={kind === value} onClick={() => setKind(value)}>{label}</button>)}<input className="library-search" type="search" aria-label="搜索曲库" placeholder="搜索歌手 / 歌单 / 专辑 / 歌曲" value={query} onChange={event => { setQuery(event.target.value); setPage(1); setTrackPage(1); }} /><button className="library-refresh" title="刷新曲库" aria-label="刷新曲库" disabled={busy} data-disabled-reason={'正在读取或处理数据，请稍候'} onClick={() => void load()}><RefreshCw size={17} /></button></div>
      <div className="library-grid">{visibleItems.map((item, index) => <article key={`${item.id}-${index}`} className={kind !== 'liked' ? 'library-collection-card' : ''} role={kind !== 'liked' ? 'button' : undefined} tabIndex={kind !== 'liked' ? 0 : undefined} onClick={() => { if (kind !== 'liked') void openCollection(item); }} onKeyDown={event => { if (kind !== 'liked' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); void openCollection(item); } }}>
        <div className="library-cover">{item.image || asSong(item) && songCover(asSong(item)!) ? <img src={(item.image || songCover(asSong(item)!)).replace(/^http:/, 'https:')} alt="" loading="lazy" /> : <Music2 />}</div>
        <h3>{item.title}</h3><p>{item.subtitle}</p><div>{kind === 'liked' && asSong(item) && <button className="library-icon-button" title={`播放 ${item.title}`} aria-label={`播放 ${item.title}`} onClick={() => playItem(item, items)}>{playing(item) ? <Pause size={18} /> : <Play size={18} />}</button>}</div>
      </article>)}</div>
      {busy && <p role="status">正在读取曲库…</p>}{error && <p className="library-error" role="alert">{error}</p>}{!busy && !error && !filteredItems.length && <p className="library-empty">没有匹配的内容</p>}{pagination(filteredItems.length, page, setPage)}
    </>}
    {connected && collection && <section className="library-detail">
      <div className="library-detail-toolbar"><button disabled={saving} data-disabled-reason={'正在同步歌单修改，请稍候'} className="library-icon-button" title="返回曲库" aria-label="返回曲库" onClick={() => { collectionGeneration.current++; setCollection(null); setQuery(''); setPage(1); setCollectionBusy(false); }}><ArrowLeft size={23} /></button></div>
      <header className="library-detail-header"><div className="library-detail-cover">{collection.image ? <img src={collection.image.replace(/^http:/, 'https:')} alt="" /> : <Music2 size={40} />}</div><div><span className="library-detail-eyebrow">{platformNames[provider]} · {kind === 'albums' ? '专辑' : '歌单'}</span><h3>{collection.title}</h3><p>{collection.subtitle}</p></div><button className="library-icon-button primary" title="播放歌单" aria-label="播放歌单" disabled={collectionBusy || !tracks.length} data-disabled-reason={collectionBusy ? '正在读取歌单曲目，请稍候' : '当前歌单没有可播放歌曲'} onClick={() => void playAll()}><Play size={22} fill="currentColor" /></button></header>
      {collectionBusy && <p role="status">正在读取歌曲…</p>}{collectionError && <p className="library-error" role="alert">{collectionError}</p>}
      {kind === 'playlists' && provider !== 'spotify' && <PlaylistEditor key={`${provider}:${collection.id}`} provider={provider} playlist={collection} tracks={tracks} ready={!collectionBusy && !collectionError} saving={saving} setSaving={setSaving} reload={metadata => openCollection({ ...collection, ...metadata })} asSong={asSong} currentSongId={currentSong?.songmid} playing={playing} play={track => playItem(track, tracks)} onNavigate={onNavigate} />}
      {(kind !== 'playlists' || provider === 'spotify') && <>
      <div className="library-detail-search"><input className="library-search" type="search" aria-label="搜索曲库" placeholder="搜索歌手 / 歌单 / 专辑 / 歌曲" value={query} onChange={event => { setQuery(event.target.value); setPage(1); setTrackPage(1); }} /><button aria-label="刷新歌单" disabled={collectionBusy || saving} data-disabled-reason={'正在读取或保存歌单，请稍候'} onClick={() => void openCollection(collection)}><RefreshCw size={17} /></button></div><ol className="library-track-list">{visibleTracks.map((track, index) => { const song = asSong(track); return <li key={`${track.id}-${index}`} className={song?.songmid === currentSong?.songmid ? 'current' : ''}>
        <button className="library-track-play" aria-label={`${playing(track) ? '暂停' : '播放'} ${track.title}`} title={`${playing(track) ? '暂停' : '播放'} ${track.title}`} disabled={!song} data-disabled-reason={'这首歌曲缺少可用的平台播放信息'} onClick={() => playItem(track, tracks)}>{playing(track) ? <Pause size={17} /> : <Play size={17} />}</button>
        <span className="library-track-number">{String((trackPage - 1) * pageSize + index + 1).padStart(2, '0')}</span><div className="library-track-info"><span>{track.title}</span><small>{track.subtitle}</small></div><span className="library-track-album">{song?.albumname}</span><span className="library-track-duration">{song?.duration ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : '—'}</span>
      </li>; })}</ol>
      {pagination(filteredTracks.length, trackPage, setTrackPage)}{!collectionBusy && !collectionError && !filteredTracks.length && <p className="library-empty">暂无匹配的歌曲</p>}
      </>}
    </section>}
  </div>;
}

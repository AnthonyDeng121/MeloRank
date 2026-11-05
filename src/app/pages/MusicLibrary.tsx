import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Pause, Music2, RefreshCw } from 'lucide-react';
import { QQ_MUSIC_CONFIG } from '../services/qqMusicConfig';
import { netease, spotify, type LibraryKind, type LibraryItem } from '../services/musicPlatforms';
import { neteaseSong, spotifySong, songCover, type PlatformSong } from '../services/platformSongs';
import { platformList, platformNames, usePlatformAccounts } from '../contexts/PlatformAccountsContext';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/MusicLibrary.css';

export function MusicLibrary() {
  const { accounts, activeProvider: provider, selectProvider, disconnect } = usePlatformAccounts();
  const account = accounts[provider], connected = account.connected;
  const { currentSong, isPlaying, setCurrentSong, togglePlay } = useMusic();
  const [kind, setKind] = useState<LibraryKind>('playlists');
  const [items, setItems] = useState<LibraryItem[]>([]), [tracks, setTracks] = useState<LibraryItem[]>([]);
  const [collection, setCollection] = useState<LibraryItem | null>(null);
  const [busy, setBusy] = useState(false), [collectionBusy, setCollectionBusy] = useState(false);
  const [error, setError] = useState(''), [collectionError, setCollectionError] = useState('');
  const [more, setMore] = useState(false), [collectionMore, setCollectionMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [libraryOffset, setLibraryOffset] = useState(0), [collectionOffset, setCollectionOffset] = useState(0);
  const generation = useRef(0), collectionGeneration = useRef(0);
  useEffect(() => { const changed = () => setRevision(value => value + 1); window.addEventListener('music-auth-change', changed); window.addEventListener('qqmusic-auth-change', changed); return () => { window.removeEventListener('music-auth-change', changed); window.removeEventListener('qqmusic-auth-change', changed); }; }, []);
  const qq = async (query: string) => {
    const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/library?${query}`, { headers: { 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, credentials: 'omit', signal: AbortSignal.timeout(25000) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '曲库读取失败'); return data;
  };
  const asSong = (item: LibraryItem): PlatformSong | null => item.qqSong ? { ...item.qqSong, provider: 'qq' } : item.neteaseTrack ? neteaseSong(item.neteaseTrack) : item.spotifyTrack ? spotifySong(item.spotifyTrack) : null;
  const playItem = (item: LibraryItem, source: LibraryItem[]) => {
    const song = asSong(item); if (!song) return;
    if (currentSong?.songmid === song.songmid) togglePlay();
    else setCurrentSong(song, source.map(asSong).filter((value): value is PlatformSong => !!value));
  };
  const load = async (start = 0) => {
    const ticket = ++generation.current; setBusy(true); setError('');
    try {
      const result = provider === 'qq' ? await qq(`kind=${kind}&offset=${start}`) : provider === 'netease' ? await netease.request('library', { kind, offset: start }) : await spotify.library(kind, start);
      if (ticket !== generation.current) return;
      setItems(previous => start ? [...previous, ...result.items] : result.items); setMore(!!result.hasMore); setLibraryOffset(result.nextOffset ?? start + 30);
    } catch (reason) { if (ticket === generation.current) setError((reason as Error).message); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  useEffect(() => {
    generation.current++; collectionGeneration.current++; setCollection(null); setTracks([]); setItems([]); setMore(false); setError(''); setBusy(false); setCollectionBusy(false);
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
    if (!offset) { setTracks([]); setCollectionMore(false); }
    try {
      const result = await readCollection(item, offset);
      if (ticket !== collectionGeneration.current) return;
      setTracks(previous => offset ? [...previous, ...result.items] : result.items); setCollectionMore(!!result.hasMore); setCollectionOffset(result.nextOffset ?? offset + 30);
    } catch (reason) { if (ticket === collectionGeneration.current) setCollectionError((reason as Error).message); }
    finally { if (ticket === collectionGeneration.current) setCollectionBusy(false); }
  };
  const playAll = async () => {
    if (!collection || !tracks.length || collectionBusy) return;
    const ticket = ++collectionGeneration.current; setCollectionBusy(true); setCollectionError('');
    try {
      const all = [...tracks]; let remaining = collectionMore, cursor = collectionOffset;
      while (remaining) {
        const page = await readCollection(collection, cursor);
        if (ticket !== collectionGeneration.current) return;
        const nextOffset = page.nextOffset ?? cursor + 30;
        if (nextOffset <= cursor || !page.items.length && !page.hasMore) break;
        all.push(...page.items); remaining = !!page.hasMore; cursor = nextOffset;
      }
      if (ticket !== collectionGeneration.current) return;
      setTracks(all); setCollectionMore(false);
      const queue = all.map(asSong).filter((song): song is PlatformSong => !!song);
      if (queue[0]) setCurrentSong(queue[0], queue);
    } catch (reason) { if (ticket === collectionGeneration.current) setCollectionError((reason as Error).message); }
    finally { if (ticket === collectionGeneration.current) setCollectionBusy(false); }
  };
  const playing = (item: LibraryItem) => { const song = asSong(item); return song && song.songmid === currentSong?.songmid && isPlaying; };
  return <div className="music-library-page">
    <header><div><h2>我的音乐</h2><p>连接音乐账号，查看你的歌单、喜欢的歌曲和收藏专辑</p></div>{connected && <div className="library-account"><span>{account.nickname}</span><button onClick={() => void disconnect(provider)}>断开连接</button></div>}</header>
    <div className="library-providers" role="tablist" aria-label="音乐平台">{platformList.map(value => <button key={value} role="tab" aria-selected={provider === value} onClick={() => selectProvider(value)}>{platformNames[value]}</button>)}</div>
    {!connected && <section className="library-connect"><h3>连接{platformNames[provider]}</h3><button className="library-connect-button" onClick={() => window.dispatchEvent(new CustomEvent('music-login', { detail: provider }))}>登录</button></section>}
    {connected && !collection && <>
      <div className="library-kinds" role="tablist" aria-label="曲库分类">{([['playlists', provider === 'spotify' ? '我的歌单' : '我创建的歌单'], ['liked', '喜欢的歌曲'], ['albums', '收藏专辑']] as [LibraryKind, string][]).map(([value, label]) => <button key={value} role="tab" aria-selected={kind === value} onClick={() => setKind(value)}>{label}</button>)}<button className="library-refresh" title="刷新曲库" aria-label="刷新曲库" disabled={busy} onClick={() => void load()}><RefreshCw size={17} /></button></div>
      <div className="library-grid">{items.map((item, index) => <article key={`${item.id}-${index}`}>
        <div className="library-cover">{item.image || asSong(item) && songCover(asSong(item)!) ? <img src={(item.image || songCover(asSong(item)!)).replace(/^http:/, 'https:')} alt="" loading="lazy" /> : <Music2 />}</div>
        <h3>{item.title}</h3><p>{item.subtitle}</p><div>{kind !== 'liked' ? <button onClick={() => void openCollection(item)}>查看歌曲</button> : asSong(item) && <button className="library-icon-button" title={`播放 ${item.title}`} aria-label={`播放 ${item.title}`} onClick={() => playItem(item, items)}>{playing(item) ? <Pause size={18} /> : <Play size={18} />}</button>}</div>
      </article>)}</div>
      {busy && <p role="status">正在读取曲库…</p>}{error && <p className="library-error" role="alert">{error}</p>}{!busy && !error && !items.length && <p className="library-empty">此分类暂无内容</p>}{more && <button className="library-load-more" disabled={busy} onClick={() => void load(libraryOffset)}>加载更多</button>}
    </>}
    {connected && collection && <section className="library-detail">
      <div className="library-detail-toolbar"><button className="library-icon-button" title="返回曲库" aria-label="返回曲库" onClick={() => { collectionGeneration.current++; setCollection(null); setCollectionBusy(false); }}><ArrowLeft size={23} /></button><button className="library-icon-button primary" title="播放歌单" aria-label="播放歌单" disabled={collectionBusy || !tracks.length} onClick={() => void playAll()}><Play size={22} fill="currentColor" /></button></div>
      <header className="library-detail-header"><div className="library-detail-cover">{collection.image ? <img src={collection.image.replace(/^http:/, 'https:')} alt="" /> : <Music2 size={40} />}</div><div><span className="library-detail-eyebrow">{platformNames[provider]} · {kind === 'albums' ? '专辑' : '歌单'}</span><h3>{collection.title}</h3><p>{collection.subtitle}</p></div></header>
      {collectionBusy && <p role="status">正在读取歌曲…</p>}{collectionError && <p className="library-error" role="alert">{collectionError}</p>}
      <ol className="library-track-list">{tracks.map((track, index) => { const song = asSong(track); return <li key={`${track.id}-${index}`} className={song?.songmid === currentSong?.songmid ? 'current' : ''}>
        <button className="library-track-play" aria-label={`${playing(track) ? '暂停' : '播放'} ${track.title}`} title={`${playing(track) ? '暂停' : '播放'} ${track.title}`} disabled={!song} onClick={() => playItem(track, tracks)}>{playing(track) ? <Pause size={17} /> : <Play size={17} />}</button>
        <span className="library-track-number">{String(index + 1).padStart(2, '0')}</span><div className="library-track-info"><span>{track.title}</span><small>{track.subtitle}</small></div><span className="library-track-album">{song?.albumname}</span><span className="library-track-duration">{song?.duration ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : '—'}</span>
      </li>; })}</ol>
      {collectionMore && <button className="library-load-more" disabled={collectionBusy} onClick={() => void openCollection(collection, collectionOffset)}>加载更多歌曲</button>}{!collectionBusy && !collectionError && !tracks.length && <p className="library-empty">暂无可读取的歌曲</p>}
    </section>}
  </div>;
}

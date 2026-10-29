import React, { useEffect, useRef, useState } from 'react';
import { qqMusicService } from '../services/qqMusicService';
import { QQ_MUSIC_CONFIG } from '../services/qqMusicConfig';
import { netease, spotify, type MusicProvider, type LibraryKind, type LibraryItem } from '../services/musicPlatforms';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/MusicLibrary.css';

export function MusicLibrary() {
  const [authRevision, setAuthRevision] = useState(0);
  useEffect(() => { const changed = () => setAuthRevision(v => v + 1); window.addEventListener('music-auth-change', changed); return () => window.removeEventListener('music-auth-change', changed); }, []);
  const [provider, setProvider] = useState<MusicProvider>(() => /[?&](code|connectSpotify|error)=/.test(location.search) ? 'spotify' : 'qq');
  const [collection, setCollection] = useState<LibraryItem | null>(null);
  const [tracks, setTracks] = useState<LibraryItem[]>([]);
  const [collectionError, setCollectionError] = useState('');
  const [collectionMore, setCollectionMore] = useState(false);
  const [collectionBusy, setCollectionBusy] = useState(false);
  const collectionGeneration = useRef(0);
  const [kind, setKind] = useState<LibraryKind>('playlists');
  useEffect(() => { collectionGeneration.current++; setCollection(null); setTracks([]); }, [provider, kind, authRevision]);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
    setItems([]); setOffset(0); setMore(false); setError(''); setConnected(false); setBusy(true);
    refreshAccount(provider).then(result => { if (id === generation.current) { setConnected(result.connected); setAccount(result.account); } }).catch(reason => { if (id === generation.current) setError(reason.message); }).finally(() => { if (id === generation.current) setBusy(false); });
    return () => { generation.current++; };
  }, [provider, authRevision]);
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
  const connect = async () => window.dispatchEvent(new CustomEvent('music-login', { detail: provider }));
  useEffect(() => {
    const changed = () => { if (provider === 'qq') { generation.current++; setConnected(qqMusicService.isLoggedIn()); setItems([]); setAccount(localStorage.getItem('qqMusicNickname') || 'QQ 音乐用户'); } };
    window.addEventListener('qqmusic-auth-change', changed);
    return () => window.removeEventListener('qqmusic-auth-change', changed);
  }, [provider, authRevision]);
  const openCollection = async (item: LibraryItem, start = 0) => {
    const ticket = ++collectionGeneration.current;
    setCollection(item); if (!start) { setTracks([]); setCollectionMore(false); } setCollectionError(''); setCollectionBusy(true);
    try {
      let result;
      if (provider === 'qq') {
        const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/library?kind=collection&type=${kind}&id=${encodeURIComponent(item.id)}&offset=${start}`, { headers: { 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, credentials: 'omit' });
        result = await response.json(); if (!response.ok) throw new Error(result.error);
      } else if (provider === 'netease') result = await netease.request('collection', { kind, id: item.id, offset: start });
      else {
        const data = await spotify.request(kind === 'albums' ? `/albums/${item.id}/tracks?limit=30&offset=${start}` : `/playlists/${item.id}/tracks?limit=30&offset=${start}`);
        result = { hasMore: !!data.next, items: (data.items || []).map((entry: any) => { const t = entry.track || entry; return { id: t.id, title: t.name, subtitle: (t.artists || []).map((a: any) => a.name).join(' / '), externalUrl: t.external_urls?.spotify || '' }; }) };
      }
      if (ticket === collectionGeneration.current) { setTracks(previous => start ? [...previous, ...result.items] : result.items); setCollectionMore(!!result.hasMore); }
    } catch (error) { if (ticket === collectionGeneration.current) setCollectionError((error as Error).message); }
    finally { if (ticket === collectionGeneration.current) setCollectionBusy(false); }
  };
  const disconnect = async () => {
    collectionGeneration.current++; setCollection(null); generation.current++; setConnected(false); setItems([]); setMore(false); setBusy(false); setAccount(''); setError('');
    if (provider === 'spotify') spotify.logout(); else if (provider === 'netease') await netease.logout(); else qqMusicService.logout();
  };
  return <div className="music-library-page">
    <header><div><h2>我的音乐</h2><p>连接音乐账号，查看你的歌单、喜欢的歌曲和收藏专辑</p></div>{connected && <div className="library-account"><span>{account}</span><button onClick={disconnect}>断开连接</button></div>}</header>
    <div className="library-providers" role="tablist" aria-label="音乐平台">{(['qq', 'netease', 'spotify'] as MusicProvider[]).map(value => <button key={value} role="tab" aria-selected={provider === value} onClick={() => { if (value === provider) return; generation.current++; setConnected(false); setItems([]); setProvider(value); }}>{value === 'qq' ? 'QQ 音乐' : value === 'netease' ? '网易云音乐' : 'Spotify'}</button>)}</div>
    {!connected && <section className="library-connect"><h3>连接{provider === 'qq' ? ' QQ 音乐' : provider === 'netease' ? '网易云音乐' : ' Spotify'}</h3><button className="library-connect-button" disabled={busy} onClick={connect}>登录</button></section>}
    {connected && <><div className="library-kinds" role="tablist" aria-label="曲库分类">{([['playlists', provider === 'spotify' ? '我的歌单' : '我创建的歌单'], ['liked', '喜欢的歌曲'], ['albums', '收藏专辑']] as [LibraryKind, string][]).map(([value, label]) => <button key={value} role="tab" aria-selected={kind === value} onClick={() => setKind(value)}>{label}</button>)}<button className="library-refresh" disabled={busy} onClick={() => load()}>刷新</button></div><div className="library-grid" hidden={!!collection}>{items.map((item, i) => <article key={`${item.id}-${i}`}><div className="library-cover">{item.image ? <img src={item.image.replace(/^http:/, 'https:')} alt="" loading="lazy" /> : <span>♪</span>}</div><h3>{item.title}</h3><p>{item.subtitle}</p><div>{kind !== 'liked' && <button onClick={() => openCollection(item)}>站内打开</button>}{item.qqSong && <button onClick={() => setCurrentSong(item.qqSong)}>播放</button>}{/^https:\/\//.test(item.externalUrl) && <a href={item.externalUrl} target="_blank" rel="noreferrer">在平台打开</a>}</div></article>)}</div>{!busy && !error && !items.length && <p className="library-empty">此分类暂无内容</p>}{more && !collection && <button className="library-load-more" disabled={busy} onClick={() => load(offset)}>加载更多</button>}</>}
    {collection && <section className="library-collection"><header><h3>{collection.title}</h3><button onClick={() => { collectionGeneration.current++; setCollection(null); }}>关闭</button></header>{collectionBusy && <p role="status">正在读取歌曲...</p>}{collectionError && <p role="alert">{collectionError}</p>}<ol>{tracks.map((track, index) => <li key={`${track.id}-${index}`}><span>{track.title}<small>{track.subtitle}</small></span>{track.qqSong ? <button onClick={() => setCurrentSong(track.qqSong)}>播放</button> : <a href={track.externalUrl} target="_blank" rel="noreferrer">在平台播放</a>}</li>)}</ol>{collectionMore && <button disabled={collectionBusy} onClick={() => openCollection(collection, tracks.length)}>加载更多歌曲</button>}{!collectionBusy && !collectionError && !tracks.length && <p>此歌单或专辑暂无可读取的歌曲</p>}</section>}
    {busy && <p role="status">正在读取音乐账号…</p>}{error && <p className="library-error" role="alert">{error}</p>}
  </div>;
}

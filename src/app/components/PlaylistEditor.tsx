import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Search } from 'lucide-react';
import { netease, type LibraryItem, type MusicProvider } from '../services/musicPlatforms';
import { QQ_MUSIC_CONFIG } from '../services/qqMusicConfig';
import { searchPlatform, type PlatformSong } from '../services/platformSongs';

interface Props {
  provider: MusicProvider; playlist: LibraryItem; tracks: LibraryItem[];
  ready: boolean; saving: boolean; setSaving: (value: boolean) => void;
  reload: () => Promise<void>;
}
export function PlaylistEditor({ provider, playlist, tracks, ready, saving, setSaving, reload }: Props) {
  const [editing, setEditing] = useState(false), [query, setQuery] = useState('');
  const [results, setResults] = useState<PlatformSong[]>([]), [searching, setSearching] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const [remove, setRemove] = useState<LibraryItem | null>(null);
  const [editPage, setEditPage] = useState(1);
  const mounted = useRef(true), pending = useRef(false), searchVersion = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; searchVersion.current++; }; }, []);
  useEffect(() => { setEditPage(page => Math.min(page, Math.max(1, Math.ceil(tracks.length / 12)))); }, [tracks.length]);
  const disabled = saving || !ready;
  const mutate = async (action: 'add' | 'remove' | 'reorder', trackId?: string, ids?: string[]) => {
    if (disabled || pending.current) return;
    pending.current = true; setSaving(true); setError(''); setMessage(''); setRemove(null);
    const body = { id: playlist.id, action, trackId, ids, baseIds: tracks.map(track => track.id) };
    try {
      if (provider === 'netease') await netease.request('playlist/edit', body);
      else {
        const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/playlist/edit`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '歌单保存失败');
      }
      if (mounted.current) setMessage('已同步到音乐平台。');
    } catch (reason) {
      if (mounted.current) setError(`${(reason as Error).message}。将重新读取歌单，请确认当前结果。`);
    } finally {
      if (mounted.current) {
        // Refresh even after a timeout: the platform may already have accepted it.
        await reload();
        if (mounted.current) setSaving(false);
      }
      pending.current = false;
    }
  };
  const search = async () => {
    if (!query.trim() || searching || disabled) return;
    const ticket = ++searchVersion.current;
    setSearching(true); setError(''); setResults([]);
    try {
      const response = await searchPlatform(provider, query.trim(), 10, 1);
      if (mounted.current && ticket === searchVersion.current) {
        const data = response.response || response;
        const songs = (data.data || data).song?.list || [];
        setResults(songs.map((song: any) => ({ ...song, songmid: song.songmid || song.mid, songname: song.songname || song.name })));
        if (!songs.length) setMessage('没有找到匹配的歌曲，请换个关键词。');
      }
    } catch (reason) { if (mounted.current && ticket === searchVersion.current) setError((reason as Error).message); }
    finally { if (mounted.current && ticket === searchVersion.current) setSearching(false); }
  };
  const move = (index: number, direction: number) => {
    const ids = tracks.map(track => track.id), target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void mutate('reorder', undefined, ids);
  };
  return <section className="playlist-editor" aria-label="编辑平台歌单">
    <div className="playlist-editor-heading"><div><h4>管理歌单</h4><p>添加、移除会直接同步到{provider === 'qq' ? ' QQ 音乐' : '网易云音乐'}。上移、下移会直接保存歌曲顺序。</p></div><button disabled={disabled} aria-expanded={editing} onClick={() => { setEditing(!editing); setRemove(null); }}>{editing ? '收起编辑' : '编辑歌单'}</button></div>
    {saving && <p role="status">正在保存并核对平台数据，请稍候…</p>}
    {message && <p role="status">{message}</p>}{error && <p className="library-error" role="alert">{error}</p>}
    {editing && <>
      <form className="playlist-add-search" onSubmit={event => { event.preventDefault(); void search(); }}><label htmlFor="playlist-add-query">添加歌曲</label><input id="playlist-add-query" className="library-search" value={query} placeholder="搜索歌曲名或歌手" disabled={disabled} onChange={event => { setQuery(event.target.value); searchVersion.current++; setResults([]); setSearching(false); }} /><button disabled={disabled || searching || !query.trim()}><Search size={16} />{searching ? '搜索中…' : '搜索'}</button></form>
      {!!results.length && <ul className="playlist-add-results">{results.map(song => {
        const id = provider === 'qq' ? song.songmid : song.providerId!;
        const exists = tracks.some(track => track.id === id);
        return <li key={id}><div><span>{song.songname}</span><small>{song.singer?.map(artist => artist.name).join(' / ')}</small></div><button disabled={disabled || exists} aria-label={`添加 ${song.songname}`} onClick={() => void mutate('add', id)}><Plus size={16} />{exists ? '已在歌单' : '添加'}</button></li>;
      })}</ul>}
      <p className="playlist-edit-caption">共 {tracks.length} 首 · 每次修改自动保存</p>
      <ol className="playlist-edit-tracks" start={(editPage - 1) * 12 + 1}>{tracks.slice((editPage - 1) * 12, editPage * 12).map((track, row) => {
        const index = (editPage - 1) * 12 + row;
        return <li key={track.id}><div><span>{track.title}</span><small>{track.subtitle}</small></div><div className="playlist-edit-actions"><button disabled={disabled || index === 0} aria-label={`上移 ${track.title}`} title="上移" onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button disabled={disabled || index === tracks.length - 1} aria-label={`下移 ${track.title}`} title="下移" onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button disabled={disabled} aria-label={`移除 ${track.title}`} title="从歌单移除" onClick={() => setRemove(track)}><Trash2 size={16} /></button></div></li>;
      })}</ol>
      {tracks.length > 12 && <nav className="library-pagination" aria-label="编辑歌曲分页"><button disabled={disabled || editPage === 1} onClick={() => setEditPage(editPage - 1)}>上一页</button><span>{editPage} / {Math.ceil(tracks.length / 12)}</span><button disabled={disabled || editPage * 12 >= tracks.length} onClick={() => setEditPage(editPage + 1)}>下一页</button></nav>}
      {remove && <div className="playlist-remove-confirm" role="alertdialog" aria-label="确认移除歌曲"><p>从平台歌单移除《{remove.title}》？</p><button disabled={disabled} onClick={() => setRemove(null)}>取消</button><button disabled={disabled} onClick={() => void mutate('remove', remove.id)}>确认移除</button></div>}
    </>}
  </section>;
}

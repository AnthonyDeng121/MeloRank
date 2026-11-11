import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Menu, Pencil, Plus, Search, ListOrdered, RefreshCw, X } from 'lucide-react';
import { netease, type LibraryItem, type MusicProvider } from '../services/musicPlatforms';
import { QQ_MUSIC_CONFIG } from '../services/qqMusicConfig';
import { searchPlatform, type PlatformSong } from '../services/platformSongs';
import { useRankingContext, type SavedRanking } from '../contexts/RankingContext';
import { prepareCoverUpload } from '../utils/coverUpload';
import { buildPlaylistRanking, reorderPlaylist } from '../utils/playlistRanking';

interface Props {
  provider: MusicProvider; playlist: LibraryItem; tracks: LibraryItem[];
  ready: boolean; saving: boolean; setSaving: (value: boolean) => void;
  reload: (metadata?: { title: string; image?: string }) => Promise<void>;
  asSong: (item: LibraryItem) => PlatformSong | null;
  currentSongId?: string; playing: (item: LibraryItem) => boolean;
  play: (item: LibraryItem) => void; onNavigate?: (page: string) => void;
}
export function PlaylistEditor({ provider, playlist, tracks, ready, saving, setSaving, reload, asSong, currentSongId, playing, play, onNavigate }: Props) {
  const [query, setQuery] = useState(''), [addQuery, setAddQuery] = useState('');
  const [adding, setAdding] = useState(false), [results, setResults] = useState<PlatformSong[]>([]), [searching, setSearching] = useState(false);
  const [message, setMessage] = useState(''), [error, setError] = useState('');
  const [dialog, setDialog] = useState<'metadata' | 'ranking' | null>(null);
  const [name, setName] = useState(playlist.title), [coverData, setCoverData] = useState('');
  const [uploading, setUploading] = useState(false);
  const [rankingKind, setRankingKind] = useState<'songs' | 'albums'>('songs'), [scoringMode, setScoringMode] = useState<'scoring' | 'non-scoring'>('scoring');
  const [rankingName, setRankingName] = useState(playlist.title), [year, setYear] = useState(new Date().getFullYear());
  const [savedRanking, setSavedRanking] = useState<SavedRanking | null>(null);
  const { setPendingRanking } = useRankingContext();
  const [dragId, setDragId] = useState<string | null>(null), [preview, setPreview] = useState<LibraryItem[] | null>(null);
  const drag = useRef<{ id: string; before: string[]; pointerId?: number } | null>(null);
  const previewRef = useRef<LibraryItem[]>([]), pointer = useRef({ x: 0, y: 0 });
  const mounted = useRef(true), pending = useRef(false), searchVersion = useRef(0);
  const dialogRef = useRef<HTMLElement | null>(null);
  const coverTask = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; searchVersion.current++; drag.current = null; }; }, []);
  useEffect(() => { if (dialog !== 'metadata') { coverTask.current++; setUploading(false); } }, [dialog]);
  const disabled = saving || !ready;
  const selectCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const task = ++coverTask.current; setUploading(true); setError('');
    try { const data = await prepareCoverUpload(file); if (mounted.current && task === coverTask.current) setCoverData(data); }
    catch (reason) { if (mounted.current && task === coverTask.current) setError((reason as Error).message); }
    finally { if (mounted.current && task === coverTask.current) setUploading(false); }
  };
  useEffect(() => {
    if (!dialog) return;
    const root = dialogRef.current; if (!root) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.querySelector<HTMLElement>('input, button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) { setDialog(null);  }
      if (event.key !== 'Tab') return;
      const elements = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    root.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; root.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [dialog, saving]);
  const mutate = async (action: 'add' | 'remove' | 'reorder' | 'metadata', extra: Record<string, unknown>) => {
    if (disabled || pending.current || action === 'metadata' && uploading) return;
    pending.current = true; setSaving(true); setError(''); setMessage('');
    const body = { id: playlist.id, action, baseIds: tracks.map(track => track.id), ...extra };
    let metadata: { title: string; image?: string } | undefined;
    try {
      let result;
      if (provider === 'netease') result = await netease.request('playlist/edit', body);
      else {
        const response = await fetch(`${QQ_MUSIC_CONFIG.baseUrl}/user/playlist/edit`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-QQ-Music-Cookie': localStorage.getItem('qqMusicCookie') || '' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
        result = await response.json(); if (!response.ok) throw new Error(result.error || '歌单保存失败');
      }
      metadata = result.metadata;
      if (mounted.current) { setMessage('已同步到音乐平台'); if (action === 'metadata') setDialog(null); }
    } catch (reason) { if (mounted.current) setError(`${(reason as Error).message}。将重新读取歌单，请确认当前结果。`); }
    finally {
      if (mounted.current) { try { await reload(metadata); } finally { if (mounted.current) setSaving(false); } }
      pending.current = false;
    }
  };
  const search = async () => {
    if (!addQuery.trim() || searching || disabled) return;
    const ticket = ++searchVersion.current; setSearching(true); setError(''); setResults([]);
    try {
      const response = await searchPlatform(provider, addQuery.trim(), 10, 1);
      if (mounted.current && ticket === searchVersion.current) {
        const data = response.response || response, songs = (data.data || data).song?.list || [];
        setResults(songs.map((song: any) => ({ ...song, songmid: song.songmid || song.mid, songname: song.songname || song.name })));
        if (!songs.length) setMessage('没有找到匹配的歌曲，请换个关键词');
      }
    } catch (reason) { if (mounted.current && ticket === searchVersion.current) setError((reason as Error).message); }
    finally { if (mounted.current && ticket === searchVersion.current) setSearching(false); }
  };
  const startDrag = (id: string, pointerId?: number) => {
    if (disabled || query.trim() || drag.current) return;
    drag.current = { id, pointerId, before: tracks.map(track => track.id) };
    previewRef.current = [...tracks]; setPreview([...tracks]); setDragId(id);
  };
  const hover = () => {
    if (!drag.current || drag.current.pointerId === undefined) return;
    const target = document.elementFromPoint(pointer.current.x, pointer.current.y)?.closest<HTMLElement>('[data-playlist-track]')?.dataset.playlistTrack;
    if (target && target !== drag.current.id) { previewRef.current = reorderPlaylist(previewRef.current, drag.current.id, target); setPreview(previewRef.current); }
  };
  const finishDrag = (save: boolean) => {
    const session = drag.current; if (!session) return;
    const ids = previewRef.current.map(track => track.id); drag.current = null; setDragId(null); setPreview(null);
    if (save && JSON.stringify(ids) !== JSON.stringify(session.before)) void mutate('reorder', { ids });
  };
  useEffect(() => {
    if (!dragId) return;
    const previous = document.body.style.userSelect; document.body.style.userSelect = 'none'; let frame: number;
    const tick = () => {
      if (drag.current?.pointerId !== undefined) {
        const y = pointer.current.y, edge = 90;
        const delta = y < edge ? -Math.min(18, (edge - y) / 4) : y > innerHeight - edge ? Math.min(18, (y - innerHeight + edge) / 4) : 0;
        if (delta) { window.scrollBy(0, delta); hover(); }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') finishDrag(false); };
    window.addEventListener('keydown', cancel);
    const move = (event: PointerEvent) => { if (drag.current?.pointerId === event.pointerId) { pointer.current = { x: event.clientX, y: event.clientY }; hover(); } };
    const up = (event: PointerEvent) => { if (drag.current?.pointerId === event.pointerId) finishDrag(true); };
    const abort = () => finishDrag(false);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', abort);
    return () => { cancelAnimationFrame(frame); document.body.style.userSelect = previous; window.removeEventListener('keydown', cancel); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', abort); };
  }, [dragId]);
  const saveRanking = () => {
    try {
      if (!rankingName.trim() || !Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('请填写榜单名称和有效年份');
      const songs = tracks.map(asSong); if (songs.some(song => !song)) throw new Error('部分歌曲信息不完整，请刷新后再保存');
      const rankingList = buildPlaylistRanking(songs as PlatformSong[], rankingKind);
      if (!rankingList.length) throw new Error('空歌单不能保存为年度榜单');
      const existing = JSON.parse(localStorage.getItem('yearlyRankings') || '[]');
      if (!Array.isArray(existing)) throw new Error('历史榜单数据格式异常，未覆盖原有数据');
      const now = new Date().toISOString();
      const record: SavedRanking = { id: `ranking_${crypto.randomUUID()}`, name: rankingName.trim(), year, type: rankingKind === 'songs' ? '年度单曲榜' : '年度专辑榜', scoringMode, rankingList, createdAt: now, updatedAt: now };
      localStorage.setItem('yearlyRankings', JSON.stringify([...existing, record]));
      setSavedRanking(record); setDialog(null); setMessage(`已保存新榜单「${record.name}」，共 ${rankingList.length} 项`); setError('');
    } catch (reason) { setError((reason as Error).message); }
  };
  const list = (preview || tracks).filter(track => [track.title, track.subtitle, asSong(track)?.albumname].filter(Boolean).join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const dragKeys = (event: React.KeyboardEvent, id: string) => {
    if (event.key === ' ' && !drag.current) { event.preventDefault(); startDrag(id); return; }
    if (drag.current?.pointerId !== undefined || drag.current?.id !== id) return;
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); const index = previewRef.current.findIndex(value => value.id === id);
      const target = previewRef.current[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (target) { previewRef.current = reorderPlaylist(previewRef.current, id, target.id); setPreview(previewRef.current); }
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); finishDrag(true); }
    else if (event.key === 'Escape') finishDrag(false);
  };
  return <section className="playlist-workspace" aria-label="平台歌单编辑">
    <div className="playlist-toolbar"><p className="playlist-sync-note">歌单编辑结果会同步对应音乐平台</p><input className="library-search" aria-label="搜索歌单歌曲" placeholder="搜索歌曲 / 歌手 / 专辑" value={query} disabled={saving || !!dragId} onChange={event => setQuery(event.target.value)} /><button aria-label="刷新歌单" title="刷新歌单" disabled={disabled || !!dragId} onClick={() => void reload()}><RefreshCw size={16} /></button><button disabled={disabled || !!dragId} onClick={() => setAdding(!adding)}><Plus size={16} />添加歌曲</button><button disabled={disabled || !!dragId} onClick={() => { setName(playlist.title); setCoverData(''); setDialog('metadata'); }}><Pencil size={16} />编辑歌单</button><button disabled={disabled || !tracks.length || !!dragId} onClick={() => { setRankingName(playlist.title); setDialog('ranking'); }}><ListOrdered size={16} />保存年度榜单</button></div>
    <div className="playlist-list-caption"><span>共 {tracks.length} 首{query && ` · 匹配 ${list.length} 首`}</span></div>
    {saving && <p role="status">正在保存并核对平台数据…</p>}{message && <p className="playlist-status" role="status">{message}{savedRanking && onNavigate && <button onClick={() => { setPendingRanking(savedRanking); onNavigate('yearly-ranking'); }}>打开榜单</button>}</p>}{error && <p className="library-error" role="alert">{error}</p>}
    {adding && <div className="playlist-add-panel"><form className="playlist-add-search" onSubmit={event => { event.preventDefault(); void search(); }}><label htmlFor="playlist-add-query">搜索添加</label><input id="playlist-add-query" className="library-search" value={addQuery} placeholder="搜索歌曲名或歌手" disabled={disabled} onChange={event => { setAddQuery(event.target.value); searchVersion.current++; setResults([]); setSearching(false); }} /><button className="playlist-search-icon" aria-label="搜索歌曲" title="搜索歌曲" disabled={disabled || searching || !addQuery.trim()}><Search size={16} /></button><button type="button" aria-label="关闭添加歌曲" onClick={() => setAdding(false)}><X size={16} /></button></form>
      {!!results.length && <ul className="playlist-add-results">{results.map(song => { const id = provider === 'qq' ? song.songmid : song.providerId!; const exists = tracks.some(track => track.id === id); return <li key={id}><div><span>{song.songname}</span><small>{song.singer?.map(artist => artist.name).join(' / ')}</small></div><button disabled={disabled || exists} onClick={() => void mutate('add', { trackId: id })}><Plus size={16} />{exists ? '已在歌单' : '添加'}</button></li>; })}</ul>}
    </div>}
    <ol className="library-track-list playlist-unified-list">{list.map((track, index) => { const song = asSong(track); return <li key={track.id} data-playlist-track={track.id} className={`${song?.songmid === currentSongId ? 'current' : ''} ${dragId === track.id ? 'playlist-dragging' : ''}`}>
      <button className="library-track-play" aria-label={`${playing(track) ? '暂停' : '播放'} ${track.title}`} disabled={!song || !!dragId} onClick={() => play(track)}>{playing(track) ? <Pause size={17} /> : <Play size={17} />}</button><span className="library-track-number">{String(index + 1).padStart(2, '0')}</span><div className="library-track-info"><span>{track.title}</span><small>{track.subtitle}</small></div><span className="library-track-album">{song?.albumname}</span><span className="library-track-duration" aria-label="歌曲时长">{song?.duration ? `${Math.floor(song.duration / 60)}:${String(Math.floor(song.duration % 60)).padStart(2, '0')}` : '—'}</span>
      <div className="playlist-row-actions"><button className="playlist-drag-handle playlist-row-button" aria-label={`拖动 ${track.title} 调整顺序`} aria-pressed={dragId === track.id} disabled={disabled || !!query.trim()} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); pointer.current = { x: event.clientX, y: event.clientY }; startDrag(track.id, event.pointerId); if (drag.current) event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) finishDrag(true); }} onPointerCancel={() => finishDrag(false)} onKeyDown={event => dragKeys(event, track.id)}><Menu size={21} /></button></div>
    </li>; })}</ol>{!list.length && ready && <p className="library-empty">暂无匹配的歌曲</p>}
    {dialog && <div className="playlist-dialog-backdrop"><form ref={element => { dialogRef.current = element; }} className="playlist-dialog" role="dialog" aria-modal="true" aria-label={dialog === 'metadata' ? '编辑歌单' : '保存年度榜单'} onSubmit={event => { event.preventDefault(); if (dialog === 'metadata') void mutate('metadata', { name, baseName: playlist.title, ...(coverData ? { coverData } : {}) }); else saveRanking(); }}>
      <h3>{dialog === 'metadata' ? '编辑歌单' : '将歌单保存为年度榜单'}</h3>
      {dialog === 'metadata' ? <><label>歌单名称<input autoFocus value={name} maxLength={provider === 'qq' ? 20 : 40} disabled={disabled} required onChange={event => setName(event.target.value)} /></label><label className="playlist-local-cover">封面图片<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading} onChange={selectCover} /></label><p>{uploading ? "正在处理图片…" : "选择本地图片，将居中裁剪为正方形封面"}</p>{(coverData || playlist.image) && <img className="playlist-upload-preview" src={coverData || playlist.image} alt="封面预览" />}</> : <><label>榜单名称<input autoFocus value={rankingName} required onChange={event => setRankingName(event.target.value)} /></label><label>年份<input type="number" value={year} min="1900" max="2100" required onChange={event => setYear(Number(event.target.value))} /></label><label>榜单类型<select value={rankingKind} onChange={event => setRankingKind(event.target.value as 'songs' | 'albums')}><option value="songs">年度单曲榜</option><option value="albums">年度专辑榜</option></select></label><label>评分模式<select value={scoringMode} onChange={event => setScoringMode(event.target.value as 'scoring' | 'non-scoring')}><option value="scoring">评分</option><option value="non-scoring">不评分</option></select></label><p>保留歌单原顺序，所有初始分数为 0。专辑榜按同一专辑首次出现的位置合并。保存为独立新榜单，不覆盖历史榜单。</p></>}
      {error && <p role="alert" className="library-error">{error}</p>}<div className="playlist-dialog-actions"><button type="button" disabled={saving} onClick={() => setDialog(null)}>取消</button><button disabled={disabled || uploading || (dialog === 'metadata' && !name.trim())}>{dialog === 'metadata' ? '保存到平台' : '保存为新榜单'}</button></div>
    </form></div>}
  </section>;
}

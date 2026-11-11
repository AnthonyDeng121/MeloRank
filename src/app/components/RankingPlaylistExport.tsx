import React, { useEffect, useRef, useState } from 'react';
import { usePlatformAccounts, platformNames } from '../contexts/PlatformAccountsContext';
import type { RankingItem } from '../contexts/RankingContext';
import type { LibraryItem } from '../services/musicPlatforms';
import { appendRankingTracks, matchRankingEntry, readOwnPlaylists, type TransferMatch, type WritableProvider } from '../services/playlistTransfer';
import type { PlatformSong } from '../services/platformSongs';
import '../../styles/PlaylistTransfer.css';

export function RankingPlaylistExport({ items, albums, disabled }: { items: RankingItem[]; albums: boolean; disabled: boolean }) {
  const { accounts, activeProvider } = usePlatformAccounts();
  const [open, setOpen] = useState(false), [provider, setProvider] = useState<WritableProvider>(activeProvider === 'netease' ? 'netease' : 'qq');
  const [playlists, setPlaylists] = useState<LibraryItem[]>([]), [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false), [matching, setMatching] = useState(false), [writing, setWriting] = useState(false);
  const [plan, setPlan] = useState<TransferMatch[] | null>(null), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const ticket = useRef(0), snapshot = useRef<RankingItem[]>([]), pending = useRef(false), mounted = useRef(true);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ticket.current++; }; }, []);
  useEffect(() => {
    const generation = ++ticket.current; setPlan(null); setError(''); setProgress(''); setPlaylists([]); setTarget(''); setMatching(false);
    if (!open || !accounts[provider].connected) { setLoading(false); return; }
    setLoading(true);
    readOwnPlaylists(provider).then(values => { if (generation === ticket.current) { setPlaylists(values); setTarget(values[0]?.id || ''); } }).catch(reason => { if (generation === ticket.current) setError(reason.message); }).finally(() => { if (generation === ticket.current) setLoading(false); });
    return () => { ticket.current++; };
  }, [open, provider, accounts[provider].connected, reload]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.querySelector<HTMLElement>('button, select')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending.current) setOpen(false);
      if (event.key !== 'Tab') return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)') || [])];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, [open]);
  const match = async () => {
    if (matching || writing || loading || !target) return;
    const generation = ++ticket.current, result: TransferMatch[] = [];
    setMatching(true); setError(''); setPlan(null);
    for (let index = 0; index < snapshot.current.length; index++) {
      if (generation !== ticket.current) return;
      setProgress(`正在匹配 ${index + 1} / ${snapshot.current.length}`);
      result.push(await matchRankingEntry(provider, snapshot.current[index], albums));
    }
    if (generation === ticket.current) { setPlan(result); setMatching(false); setProgress('匹配完成，请核对歌曲版本后导入'); }
  };
  const write = async () => {
    if (pending.current || !plan || !target) return;
    const songs = plan.flatMap(value => value.song ? [value.song] : []);
    if (!songs.length) return;
    pending.current = true; setWriting(true); setError(''); setProgress('正在读取目标歌单…');
    try {
      const result = await appendRankingTracks(provider, target, songs, (done, total) => { if (mounted.current) setProgress(`正在添加 ${done} / ${total}，完成后核对顺序…`); });
      if (mounted.current) { setProgress(`已导入 ${result.added} 首，跳过 ${result.skipped} 首已有或重复歌曲。平台顺序已核对。`); setPlan(null); }
    } catch (reason) { if (mounted.current) setError((reason as Error).message); }
    finally { pending.current = false; if (mounted.current) setWriting(false); }
  };
  const found = plan?.filter(value => value.song).length || 0;
  return <>
    <button className="export-btn" disabled={disabled || !items.length} data-disabled-reason={'请先创建或导入实际榜单，再导入平台歌单'} onClick={() => { snapshot.current = items.map(item => ({ ...item })); setOpen(true); }}>导入平台歌单</button>
    {open && <div className="rank-transfer-overlay"><div ref={dialog} className="rank-transfer-dialog" role="dialog" aria-modal="true" aria-label="导入平台歌单">
      <h3>将榜单导入歌单</h3><p>追加到本人创建的歌单。已有歌曲保留位置，新增歌曲按榜单顺序排列。</p>
      <label>音乐平台<select value={provider} disabled={writing} data-disabled-reason={'正在同步到音乐平台，请等待操作完成'} onChange={event => setProvider(event.target.value as WritableProvider)}><option value="qq">QQ 音乐</option><option value="netease">网易云音乐</option></select></label>
      {!accounts[provider].connected ? <p role="alert">请先登录{platformNames[provider]}，登录后重新打开此窗口。</p> : <label>目标歌单<select value={target} disabled={loading || writing || matching} data-disabled-reason={'正在读取、匹配或同步歌单，请等待当前操作完成'} onChange={event => { setTarget(event.target.value); setPlan(null); setProgress(''); }}><option value="">{loading ? '正在读取歌单…' : '选择本人创建的歌单'}</option>{playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.title}</option>)}</select></label>}
      {albums && <p>平台未提供可核实的单曲收藏量，本次选取每张专辑的第一首歌曲。</p>}
      {accounts[provider].connected && !loading && !playlists.length && <p>未找到可编辑歌单，可先在音乐平台创建普通歌单，再刷新此列表。</p>}
      <div className="rank-transfer-actions"><button disabled={writing || matching || loading} data-disabled-reason={'正在读取、匹配或同步歌单，请等待当前操作完成'} onClick={() => setReload(value => value + 1)}>刷新歌单</button><button disabled={!target || loading || writing || matching} data-disabled-reason={!target ? '请先登录平台并选择目标歌单' : '正在处理歌单，请稍候'} onClick={() => void match()}>{matching ? '匹配中…' : '匹配并预览'}</button></div>
      {progress && <p role="status">{progress}</p>}{error && <p className="rank-transfer-error" role="alert">{error}</p>}
      {plan && <><p>匹配 {found} / {plan.length} 项；只导入匹配成功的歌曲。</p><ol className="rank-transfer-preview">{plan.map((value, index) => <li key={`${value.entry.id}-${index}`}><strong>{index + 1}. {value.entry.title}</strong>{value.song ? <><span>{value.song.songname} · {value.song.singer.map(artist => artist.name).join(' / ')}</span><small>{value.song.albumname}</small></> : <span className="rank-transfer-error">{value.error}</span>}</li>)}</ol></>}
      <div className="rank-transfer-actions"><button disabled={writing} data-disabled-reason={'正在同步到音乐平台，请等待操作完成'} onClick={() => setOpen(false)}>关闭</button><button className="rank-transfer-primary" disabled={!found || writing || matching || !target} data-disabled-reason={!target ? '请先选择目标歌单' : !found ? '请先匹配歌曲，至少需要一首匹配成功的歌曲' : '正在匹配或导入歌曲，请稍候'} onClick={() => void write()}>{writing ? '导入中…' : `确认导入 ${found} 项`}</button></div>
    </div></div>}
  </>;
}

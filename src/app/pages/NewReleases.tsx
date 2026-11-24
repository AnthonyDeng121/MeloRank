import { ArrowUpRight, Bookmark, Disc3, ListMusic, Play, SlidersHorizontal } from 'lucide-react';
import { musicBrainzNewReleases } from '../services/newReleaseSources';
import React, { useEffect, useState } from 'react';
import { getCatalogDetail, searchCatalog, type CatalogItem } from '../services/catalog';
import { qqMusicService } from '../services/qqMusicService';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/NewReleases.css';

const formats = ['未分类', '专辑', 'EP', '单曲', '原声带', '精选', '现场', '豪华版／再版'] as const;
type Format = typeof formats[number];
type Release = Omit<CatalogItem, 'provider'> & { provider: CatalogItem['provider'] | 'musicbrainz'; format: Format; genre: string; dateHint?: string; manual?: boolean };
type Decision = '想听' | '跳过' | '已收藏';
type Library = { items: Release[]; decisions: Record<string, Decision>; tags: Record<string, {format: Format; genre: string}>; hidden: string[] };
const keyOf = (item: Release) => item.provider + ':' + item.id;
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '');
const storageKey = 'melorank-new-releases-v1';
const emptyLibrary: Library = { items: [], decisions: {}, tags: {}, hidden: [] };

function readLibrary(): Library {
  try { return JSON.parse(localStorage.getItem(storageKey) || 'null') ?? emptyLibrary; }
  catch { return emptyLibrary; }
}
function titleFormat(title: string): Format {
  if (/原声带|soundtrack/i.test(title)) return '原声带';
  if (/豪华版|再版|deluxe|reissue/i.test(title)) return '豪华版／再版';
  if (/精选|greatest hits/i.test(title)) return '精选';
  if (/现场版|live at/i.test(title)) return '现场';
  if (/(?:^|[\s\-（(])EP\b/i.test(title)) return 'EP';
  return '未分类';
}

export function NewReleases({ onOpen }: { onOpen: (item: CatalogItem) => void }) {
  const { setCurrentSong } = useMusic();
  const [feed, setFeed] = useState<Release[]>([]);
  const [globalFeed, setGlobalFeed] = useState<Release[]>([]);
  const [source, setSource] = useState('');
  const [globalState, setGlobalState] = useState({ pending: true, failed: false, hasMore: true });
  const [library, setLibrary] = useState(readLibrary);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [days, setDays] = useState('7');
  const [format, setFormat] = useState('');
  const [genre, setGenre] = useState('');
  const [excludedGenre, setExcludedGenre] = useState('');
  const [visibility, setVisibility] = useState('active');
  const [pending, setPending] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof getCatalogDetail>>>();
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(library)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [library]);
  useEffect(() => {
    let current = true;
    setStatus('正在读取 QQ 音乐新碟…');
    void qqMusicService.getNewAlbums(80, page).then(result => {
      if (!current) return;
      const rows = (result.body ?? result).response?.new_album?.data?.albums;
      if (!Array.isArray(rows)) throw new Error('Missing album list');
      const releases: Release[] = rows.filter(row => row.mid && row.name).map(row => ({
        provider: 'qq', kind: 'albums', id: row.mid, title: row.name,
        artist: (row.singers ?? []).map((artist: {name: string}) => artist.name).join(' / '),
        image: 'https://y.qq.com/music/photo_new/T002R300x300M000' + row.mid + '.jpg',
        date: row.release_time, genre: row.str_genre?.trim() || '未分类', format: titleFormat(row.name),
      }));
      setFeed(previous => [...new Map([...(page === 1 ? [] : previous), ...releases].map(item => [keyOf(item), item])).values()]);
      setStatus(releases.length < 80 ? '已读到来源列表末尾' : '');
    }).catch(() => { if (current) setStatus('暂时无法读取 QQ 音乐新碟，请重试。'); });
    return () => { current = false; };
  }, [page, retry]);

  useEffect(() => {
    const controller = new AbortController();
    setGlobalState(previous => ({ ...previous, pending: true, failed: false }));
    void musicBrainzNewReleases(page, 40, controller.signal).then(({ items, hasMore }) => {
      if (controller.signal.aborted) return;
      const entries: Release[] = items.map(item => ({ ...item, kind: 'albums', provider: 'musicbrainz' }));
      setGlobalFeed(previous => [...new Map([...(page === 1 ? [] : previous), ...entries].map(item => [keyOf(item), item])).values()]);
      setGlobalState({ pending: false, failed: false, hasMore });
    }).catch(() => {
      if (!controller.signal.aborted) setGlobalState(previous => ({ ...previous, pending: false, failed: true }));
    });
    return () => controller.abort();
  }, [page, retry]);

  useEffect(() => {
    if (preview) document.getElementById('release-tracks')?.scrollIntoView({ block: 'nearest' });
  }, [preview]);

  const all = [...new Map([...library.items.filter(item => !item.manual), ...feed, ...globalFeed, ...library.items.filter(item => item.manual)].map(item => [keyOf(item), item])).values()].map(item =>
    library.tags[keyOf(item)] ? { ...item, ...library.tags[keyOf(item)] } : item);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - Number(days) + 1);
  const start = threshold.toLocaleDateString('sv-SE');
  const today = new Date().toLocaleDateString('sv-SE');
  const genres = [...new Set(all.map(item => item.genre))].sort();
  const queue = all.filter(item => library.decisions[keyOf(item)] === '想听');
  const visible = all.filter(item => {
    const decision = library.decisions[keyOf(item)];
    if (saved) return decision === '已收藏';
    if (source && item.provider !== source) return false;
    if (library.hidden.includes(item.artist)) return false;
    return (visibility === 'all' || !decision || decision === '想听') &&
      (!days || !item.date || (item.date >= start && item.date <= today)) &&
      (!format || item.format === format) && (!genre || item.genre === genre) && (!excludedGenre || item.genre !== excludedGenre);
  }).sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''));
  function decide(item: Release, value?: Decision) {
    const id = keyOf(item);
    setLibrary(previous => {
      const decisions = { ...previous.decisions };
      if (value) decisions[id] = value;
      else delete decisions[id];
      return { ...previous, decisions, items: [...previous.items.filter(entry => keyOf(entry) !== id), item] };
    });
  }

  async function loadTracks(item: Release) {
    setPending(keyOf(item));
    setPreview(undefined);
    setMessage('');
    try {
      let catalog: CatalogItem;
      if (item.provider === 'musicbrainz') {
        const { items } = await searchCatalog('qq', 'albums', item.title, 12, 1);
        const match = items.find((entry: CatalogItem) => normalize(entry.title) === normalize(item.title) &&
          !!item.artist && normalize(entry.artist) === normalize(item.artist));
        if (!match) { setMessage('QQ 音乐未找到同名且同艺人的专辑，可打开 MusicBrainz 查看发行资料。'); return; }
        catalog = match;
      } else {
        catalog = { ...item, provider: item.provider };
      }
      const detail = await getCatalogDetail(catalog);
      if (!detail.songs.length) throw new Error('Empty tracks');
      setPreview(detail);
    } catch { setMessage('暂时无法读取这张专辑的曲目。'); }
    finally { setPending(''); }
  }

  return <div className="new-releases">
    <header className="release-hero"><div>
      <div className="release-hero-caption"><Disc3 size={17} aria-hidden="true" /> 新发行</div>
      <h2>新专辑 / EP 发现</h2><p>在 QQ 音乐和 MusicBrainz 里找新发行，挑出下一张想听的专辑。</p></div>
      <div className="release-toolbar"><button aria-pressed={!saved} onClick={() => setSaved(false)}>浏览新碟</button><button aria-pressed={saved} onClick={() => setSaved(true)}>已收藏</button></div></header>
    {!saved && <>
      <div className="release-toolbar release-filters">
        <label>来源<select value={source} onChange={e => setSource(e.target.value)}><option value="">全部来源</option><option value="qq">QQ 音乐</option><option value="musicbrainz">MusicBrainz</option></select></label>
        <label>发行时间<select value={days} onChange={e => setDays(e.target.value)}><option value="7">近七天</option><option value="30">近三十天</option><option value="">不限</option></select></label>
        <label>类型<select value={format} onChange={e => setFormat(e.target.value)}><option value="">不限</option>{formats.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>风格<select value={genre} onChange={e => setGenre(e.target.value)}><option value="">不限</option>{genres.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>排除风格<select value={excludedGenre} onChange={e => setExcludedGenre(e.target.value)}><option value="">不排除</option>{genres.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>浏览状态<select value={visibility} onChange={e => setVisibility(e.target.value)}><option value="active">待筛选／想听</option><option value="all">含已处理</option></select></label>
        <button className="release-primary" disabled={!queue.length} onClick={() => setLibrary(previous => ({ ...previous, decisions: Object.fromEntries(Object.entries(previous.decisions).map(([id, value]) => [id, value === '想听' ? '已收藏' : value])) }))}>批量收藏想听（{queue.length}）</button>
      </div>
      <details className="release-tools"><summary><SlidersHorizontal size={14} aria-hidden="true" /> 补录与屏蔽设置</summary>
        <form className="release-toolbar" onSubmit={event => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const title = String(data.get('title') ?? '').trim();
          const artist = String(data.get('artist') ?? '').trim();
          const input = String(data.get('mid') ?? '').trim();
          const id = /^(?:https:\/\/y\.qq\.com\/n\/ryqq\/albumDetail\/)?([0-9A-Za-z]{14})(?:[?#].*)?$/.exec(input)?.[1];
          if (!id || !title || !artist) { setMessage('请输入作品名、艺人和有效的 QQ 音乐专辑链接或 ID。'); return; }
          const item: Release = { id, title, artist, provider: 'qq', kind: 'albums', image: 'https://y.qq.com/music/photo_new/T002R300x300M000' + id + '.jpg', format: titleFormat(title), genre: '未分类', manual: true };
          setLibrary(previous => ({ ...previous, items: [...previous.items.filter(entry => keyOf(entry) !== keyOf(item)), item] }));
          setMessage('已补录到发现列表。');
          form.reset();
        }}>
          <input name="title" aria-label="专辑名" placeholder="专辑名" required /><input name="artist" aria-label="艺人" placeholder="艺人" required />
          <input name="mid" aria-label="QQ 音乐专辑链接或 ID" placeholder="QQ 音乐专辑链接或 ID" required /><button>补录</button>
        </form>
        {library.hidden.map(artist => <button key={artist} onClick={() => setLibrary(previous => ({ ...previous, hidden: previous.hidden.filter(name => name !== artist) }))}>取消屏蔽 {artist}</button>)}
      </details>
    </>}
    {storageError && <p role="alert">浏览器存储写入失败，本次修改可能在刷新后丢失。</p>}
    {message && <p role="status">{message}</p>}
    {!saved && <div className="release-results">
      <h3>发行列表 <small>{visible.length}</small></h3>
      <p role="status">{status.startsWith('暂时') ? 'QQ 音乐暂不可用。 ' : status.startsWith('正在') ? 'QQ 音乐加载中。 ' : ''}
        {globalState.failed ? 'MusicBrainz 暂不可用。' : globalState.pending ? 'MusicBrainz 加载中。' : ''}</p>
    </div>}
    {preview && <section id="release-tracks" className="release-tracks" aria-label="试听曲目">
      <header><strong>{preview.item.title} · 试听曲目</strong><button onClick={() => setPreview(undefined)}>收起</button></header>
      <div className="release-toolbar">{preview.songs.map(song => <button key={song.songmid} onClick={() => setCurrentSong(song)}>▶ {song.songname}</button>)}</div>
      <p className="release-muted">使用站内播放器。音源及试听片段由平台提供。</p>
    </section>}
    <div className="release-grid">{visible.map(item => {
      const id = keyOf(item);
      const decision = library.decisions[id];
      return <article key={id} className="release-card">
        <div className="release-art"><Disc3 size={40} aria-hidden="true" />
          {item.image && <img src={item.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
        </div>
        <div className="release-meta">
          <small>{item.manual ? '手动补录' : item.provider === 'musicbrainz' ? 'MusicBrainz' : 'QQ 音乐'} · {item.date || item.dateHint || '日期未填'}</small>
          <h3 title={item.title}>{item.title}</h3><p title={item.artist}>{item.artist}</p>
          {item.format !== '未分类' && <span className="release-tag">{item.format}</span>}
        </div>
        <div className="release-toolbar release-card-actions">
          <button className="release-play" disabled={!!pending} onClick={() => void loadTracks(item)}>
            <Play size={13} /> {pending === id ? '读取中' : item.provider === 'musicbrainz' ? '找试听' : '试听'}
          </button>
          {item.provider === 'musicbrainz'
            ? <a href={`https://musicbrainz.org/release-group/${item.id}`} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> 发行资料</a>
            : <button className="release-quiet" onClick={() => onOpen({ ...item, provider: item.provider as CatalogItem['provider'] })}><ListMusic size={15} /> 详情</button>}
          {!saved && !decision && <><button className="release-quiet" onClick={() => decide(item, '想听')}><Bookmark size={15} /> 想听</button><button className="release-quiet" onClick={() => decide(item, '跳过')}>跳过</button></>}
          {decision && <button className="release-quiet" onClick={() => decide(item)}>{decision} · 撤销</button>}
        </div>
        {!saved && <details className="release-classify"><summary>分类与管理</summary>
          <div className="release-toolbar">
            <label>类型<select value={item.format} onChange={e => { const value = e.target.value as Format; setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: value, genre: item.genre } } })); }}>{formats.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>风格<input value={item.genre === '未分类' ? '' : item.genre} placeholder="未分类" onChange={e => { const value = e.target.value; setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: item.format, genre: value || '未分类' } } })); }} /></label>
            {item.artist && <button onClick={() => setLibrary(previous => ({ ...previous, hidden: [...previous.hidden, item.artist] }))}>屏蔽艺人栏</button>}
          </div>
        </details>}
      </article>;
    })}</div>
    {!visible.length && <p className="release-muted">{saved ? '还没有收藏的专辑。' : '当前筛选没有结果，可放宽条件或继续加载。'}</p>}
    {!saved && <div className="release-toolbar">
      <button disabled={status.startsWith('正在') || globalState.pending ||
        ((status.startsWith('已读') || status.startsWith('暂时')) && (!globalState.hasMore || globalState.failed))}
        onClick={() => setPage(value => value + 1)}>加载更多</button>
      {(status.startsWith('暂时') || globalState.failed) &&
        <button onClick={() => setRetry(value => value + 1)}>重试来源</button>}
    </div>}
  </div>;
}

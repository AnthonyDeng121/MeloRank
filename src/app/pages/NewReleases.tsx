import { ArrowUpRight, Bookmark, Disc3, ListMusic, Play, SlidersHorizontal } from 'lucide-react';
import { appleNewReleases, formats, musicBrainzNewReleases, normalize, pitchforkReviews, qqRegionReleases,
  regions, releaseIdentity, releaseKey as keyOf, sourceNames, titleFormat, verifiedReleases, type Format, type Region, type Release,
} from '../services/newReleaseSources';
import React, { useEffect, useState } from 'react';
import { getCatalogDetail, searchCatalog, type CatalogItem } from '../services/catalog';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/NewReleases.css';

type Decision = '想听' | '跳过' | '已收藏';
type Library = { items: Release[]; decisions: Record<string, Decision>; tags: Record<string, {format: Format; genre: string; region?: Region}>; hidden: string[] };
const storageKey = 'melorank-new-releases-v1';
const emptyLibrary: Library = { items: [], decisions: {}, tags: {}, hidden: [] };

function readLibrary(): Library {
  try { return JSON.parse(localStorage.getItem(storageKey) || 'null') ?? emptyLibrary; }
  catch { return emptyLibrary; }
}
export function NewReleases({ onOpen }: { onOpen: (item: CatalogItem) => void }) {
  const { setCurrentSong } = useMusic();
  const [feed, setFeed] = useState<Release[]>([]);
  const [source, setSource] = useState('');
  const [region, setRegion] = useState<Region | ''>('');
  const [reviews, setReviews] = useState<Awaited<ReturnType<typeof pitchforkReviews>>>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [priority, setPriority] = useState('curated');
  const [hideAI, setHideAI] = useState(true);
  const [library, setLibrary] = useState(readLibrary);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState(false);
  const [days, setDays] = useState('7');
  const [format, setFormat] = useState('featured');
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
    const controller = new AbortController();
    void pitchforkReviews(controller.signal).then(setReviews).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    setLoading(true);
    setFailed([]);
    if (page === 1) setFeed([]);
    const tasks: [string, Promise<Release[]>][] = [
      ['QQ 音乐', qqRegionReleases(region, page, signal)],
      ['MusicBrainz', musicBrainzNewReleases(page, format === 'EP' ? 'EP' : '专辑', Number(days) || 30, signal)],
    ];
    if (page === 1) tasks.push(['Apple 地区榜', appleNewReleases(region, signal)]);
    void Promise.all(tasks.map(async ([name, task]) => {
      try {
        const entries = await task;
        if (!signal.aborted) setFeed(previous => [...new Map([...previous, ...entries].map(item => [keyOf(item), item])).values()]);
      } catch {
        if (!signal.aborted) setFailed(previous => [...previous, name]);
      }
    })).then(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry, region, format, days]);

  useEffect(() => {
    if (preview) document.getElementById('release-tracks')?.scrollIntoView({ block: 'nearest' });
  }, [preview]);

  const all = [...new Map([...library.items.filter(item => !item.manual), ...verifiedReleases, ...feed, ...library.items.filter(item => item.manual)].map(item => [keyOf(item), item])).values()].map(item =>
    library.tags[keyOf(item)] ? { ...item, ...library.tags[keyOf(item)] } : item);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - Number(days) + 1);
  const start = threshold.toLocaleDateString('sv-SE');
  const today = new Date().toLocaleDateString('sv-SE');
  const genres = [...new Set(all.map(item => item.genre))].sort();
  const queue = all.filter(item => library.decisions[keyOf(item)] === '想听');
  const hasReview = (item: Release) => reviews.find(review =>
    normalize(review.title) === normalize(item.title) && !!item.artist &&
    normalize(new URL(review.url).pathname).includes(normalize(item.artist)));
  const sightings = new Map<string, Release[]>();
  for (const item of all) {
    const identity = releaseIdentity(item);
    sightings.set(identity, [...(sightings.get(identity) ?? []), item]);
  }
  const candidates = all.map(item => {
    const same = item.artist ? sightings.get(releaseIdentity(item)) ?? [item] : [item];
    const verified = verifiedReleases.find(entry => item.artist && releaseIdentity(entry) === releaseIdentity(item));
    const known = verified ?? same.find(entry => entry.quality === '明确标注') ??
      same.find(entry => entry.provider === 'apple' && entry.format !== '未分类');
    const review = hasReview(item);
    const preferredArt = same.find(entry => entry.provider !== 'musicbrainz' && entry.image)?.image;
    return {
      ...item, image: preferredArt || review?.image || item.image, format: library.tags[keyOf(item)]?.format ?? known?.format ?? item.format,
      genre: library.tags[keyOf(item)]?.genre ?? (item.genre !== '未分类' ? item.genre : known?.genre ?? item.genre),
      region: library.tags[keyOf(item)]?.region ?? known?.region ?? item.region ?? same.find(entry => entry.region)?.region,
      ai: same.some(entry => entry.ai),
      review,
      chartRank: same.find(entry => entry.chartRank)?.chartRank,
      sourceCount: new Set(same.map(entry => entry.provider)).size,
    };
  });
  const decisionFor = (item: Release) => library.decisions[keyOf(item)] ??
    (item.artist ? sightings.get(releaseIdentity(item))?.map(entry => library.decisions[keyOf(entry)]).find(Boolean) : undefined);
  const matched = candidates.filter(item => {
    const decision = library.decisions[keyOf(item)];
    if (saved) return decision === '已收藏';
    const discoveryDecision = decisionFor(item);
    if (source && item.provider !== source) return false;
    if (region && (item.region ?? '其他／待确认') !== region) return false;
    if (library.hidden.includes(item.artist) || (hideAI && item.ai)) return false;
    const matchesFormat = format === 'featured' ? ['专辑', 'EP'].includes(item.format) : !format || item.format === format;
    return (visibility === 'all' || !discoveryDecision || discoveryDecision === '想听') &&
      (item.manual || !days || (item.date ? item.date >= start && item.date <= today : format === 'EP' || !format || format === '未分类')) &&
      matchesFormat && (!genre || item.genre === genre) && (!excludedGenre || item.genre !== excludedGenre);
  }).sort((left, right) => {
    const score = (item: typeof left) => (item.review ? 4 : 0) + (item.chartRank ? 2 : 0) + (item.sourceCount > 1 ? 1 : 0);
    return Number(!!right.date) - Number(!!left.date) ||
      (priority === 'curated' && !saved ? score(right) - score(left) : 0) ||
      (right.date ?? '').localeCompare(left.date ?? '') ||
      Number(right.provider === 'qq') - Number(left.provider === 'qq');
  });
  const seen = new Set<string>();
  const visible = matched.filter(item => {
    const identity = saved || !item.artist ? keyOf(item) : releaseIdentity(item);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
  function decide(item: Release, value?: Decision) {
    const id = keyOf(item);
    setLibrary(previous => {
      const decisions = { ...previous.decisions };
      if (item.artist) {
        for (const same of sightings.get(releaseIdentity(item)) ?? []) delete decisions[keyOf(same)];
      }
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
      if (item.provider !== 'qq') {
        const { items } = await searchCatalog('qq', 'albums', item.title, 12, 1);
        const match = items.find((entry: CatalogItem) => normalize(entry.title) === normalize(item.title) &&
          !!item.artist && normalize(entry.artist) === normalize(item.artist));
        if (!match) { setMessage('QQ 音乐未找到同名且同艺人的专辑，可打开来源查看发行资料。'); return; }
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
      <h2>新专辑 / EP 发现</h2><p>从地区新发行与编辑推荐里，挑出下一张想听的专辑。</p></div>
      <div className="release-toolbar"><button aria-pressed={!saved} onClick={() => setSaved(false)}>浏览新碟</button><button aria-pressed={saved} onClick={() => setSaved(true)}>已收藏</button></div></header>
    {!saved && <>
      <section className="release-controls" aria-label="筛选发行">
        <div className="release-control-row"><span>类型</span><div className="release-chips">
          {[['featured','专辑 + EP'],['专辑','专辑'],['EP','EP'],['单曲','单曲']].map(([value,label]) => <button key={value}
            aria-pressed={format === value} onClick={() => { setPage(1); setFormat(value); }}>{label}</button>)}
          <select aria-label="其他发行类型" value={['featured','专辑','EP','单曲'].includes(format) ? 'more' : format}
            onChange={event => { setPage(1); setFormat(event.target.value); }}>
            <option value="more" disabled>其他类型</option><option value="">全部类型</option>
            {formats.slice(3).map(value => <option key={value}>{value}</option>)}
          </select>
        </div></div>
        <div className="release-control-row"><span>地区</span><div className="release-chips">
          {(['', ...regions] as const).map(value => <button key={value}
            aria-pressed={region === value} onClick={() => { setPage(1); setRegion(value); }}>{value || '全部地区'}</button>)}
        </div></div>
        <div className="release-controls-footer">
          <div className="release-chips">
            <label>时间<select value={days} onChange={event => { setPage(1); setDays(event.target.value); }}><option value="7">近七天</option><option value="30">近三十天</option></select></label>
            <label>排序<select value={priority} onChange={event => setPriority(event.target.value)}><option value="curated">优先有推荐依据</option><option value="latest">按发行时间</option></select></label>
          </div>
          <button className="release-primary" disabled={!queue.length} onClick={() => setLibrary(previous => ({ ...previous,
            decisions: Object.fromEntries(Object.entries(previous.decisions).map(([id, value]) => [id, value === '想听' ? '已收藏' : value])) }))}>
            <Bookmark size={14} aria-hidden="true" /> 收藏想听（{queue.length}）
          </button>
        </div>
      </section>
      <div className="release-utilities">
      <details className="release-tools">
        <summary><SlidersHorizontal size={14} aria-hidden="true" /> 更多筛选</summary>
        <div className="release-toolbar">
          <label>来源<select value={source} onChange={event => setSource(event.target.value)}><option value="">全部来源</option>
            {Object.entries(sourceNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
          <label>风格<select value={genre} onChange={event => setGenre(event.target.value)}><option value="">不限</option>{genres.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>排除风格<select value={excludedGenre} onChange={event => setExcludedGenre(event.target.value)}><option value="">不排除</option>{genres.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>浏览状态<select value={visibility} onChange={event => setVisibility(event.target.value)}><option value="active">待筛选／想听</option><option value="all">含已处理</option></select></label>
          <label className="release-check"><input type="checkbox" checked={hideAI} onChange={event => setHideAI(event.target.checked)} /> 隐藏来源明确标注的 AI 发行</label>
        </div>
      </details>
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
      </div>
    </>}
    {storageError && <p role="alert">浏览器存储写入失败，本次修改可能在刷新后丢失。</p>}
    {message && <p role="status">{message}</p>}
    {!saved && <div className="release-results">
      <h3>{format === 'featured' ? '新专辑与 EP' : format || '发行列表'} <small>{visible.length}</small></h3>
      <p role="status">{loading ? '正在补全发行资料…' : ''}{failed.length ? ` ${failed.join('、')}暂不可用。` : ''}</p>
    </div>}
    {preview && <section id="release-tracks" className="release-tracks" aria-label="试听曲目">
      <header><strong>{preview.item.title} · 试听曲目</strong><button onClick={() => setPreview(undefined)}>收起</button></header>
      <div className="release-toolbar">{preview.songs.map(song => <button key={song.songmid} onClick={() => setCurrentSong(song)}>▶ {song.songname}</button>)}</div>
      <p className="release-muted">使用站内播放器。音源及试听片段由平台提供。</p>
    </section>}
    <div className="release-grid">{visible.map(item => {
      const id = keyOf(item);
      const decision = saved ? library.decisions[id] : decisionFor(item);
      return <article key={id} className="release-card">
        <div className="release-art"><Disc3 size={40} aria-hidden="true" />
          {item.image && <img key={item.image} src={item.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
        </div>
        <div className="release-meta">
          <small>{item.manual ? '手动补录' : sourceNames[item.provider]} · {item.date || (item.dateHint ? item.dateHint + ' · 日期待确认' : '日期待确认')}</small>
          <h3 title={item.title}>{item.title}</h3><p title={item.artist}>{item.artist}</p>
          <div className="release-badges">
            {item.format !== '未分类' && <span className="release-tag">{item.format}</span>}
            {item.region && <span className="release-tag release-region">{item.region}</span>}
            {item.genre !== '未分类' && <span className="release-tag">{item.genre}</span>}
            {item.review ? <a className="release-tag" href={item.review.url} target="_blank" rel="noreferrer">Pitchfork 评论 ↗</a>
              : item.chartRank && <span className="release-tag">Apple 地区榜</span>}
            {item.ai && <span className="release-tag">来源标注 AI</span>}
          </div>
        </div>
        <div className="release-toolbar release-card-actions">
          <button className="release-play" disabled={!!pending} onClick={() => void loadTracks(item)}>
            <Play size={13} /> {pending === id ? '读取中' : item.provider !== 'qq' ? '找试听' : '试听'}
          </button>
          {item.provider !== 'qq'
            ? <a href={item.externalUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> 发行资料</a>
            : <button className="release-quiet" onClick={() => onOpen({ ...item, provider: 'qq' })}><ListMusic size={15} /> 详情</button>}
          {!saved && !decision && <><button className="release-quiet" onClick={() => decide(item, '想听')}><Bookmark size={15} /> 想听</button><button className="release-quiet" onClick={() => decide(item, '跳过')}>跳过</button></>}
          {decision && <button className="release-quiet" onClick={() => decide(item)}>{decision} · 撤销</button>}
        </div>
        {!saved && <details className="release-classify"><summary>分类与来源</summary>
          <div className="release-toolbar">
            <label>类型<select value={item.format} onChange={e => { const value = e.target.value as Format; setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: value, genre: item.genre, region: item.region } } })); }}>{formats.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>风格<input value={item.genre === '未分类' ? '' : item.genre} placeholder="未分类" onChange={e => { const value = e.target.value; setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: item.format, genre: value || '未分类', region: item.region } } })); }} /></label>
            <label>地区<select value={item.region ?? '其他／待确认'} onChange={event => {
              const value = event.target.value as Region;
              setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: item.format, genre: item.genre, region: value } } }));
            }}>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
            {item.quality === '按曲目推断' && <small>类型按曲目数和时长推断</small>}
            {item.sourceCount > 1 && <small>多个来源收录</small>}
            {item.artist && <button onClick={() => setLibrary(previous => ({ ...previous, hidden: [...previous.hidden, item.artist] }))}>屏蔽艺人栏</button>}
          </div>
        </details>}
      </article>;
    })}</div>
    {!visible.length && <p className="release-muted">{saved ? '还没有收藏的专辑。' : '当前筛选没有结果，可放宽条件或继续加载。'}</p>}
    {!saved && <footer className="release-footer">
      <button disabled={loading} onClick={() => setPage(value => value + 1)}>加载更多</button>
      {!!failed.length && <button disabled={loading} onClick={() => setRetry(value => value + 1)}>重试来源</button>}
      <details><summary>数据来源与覆盖</summary><p>QQ 分区新碟、Apple 地区榜近期发行和 MusicBrainz 目录共同补充候选。地区按来源分区或明确风格标签归类，可能需要修正。Pitchfork 只作为评论信号，评论日期不会当成发行日期。</p>
        <p><a href="https://www.albumoftheyear.org/releases/" target="_blank" rel="noreferrer">Album of the Year 原站 ↗</a> · <a href="https://pitchfork.com/best/albums/" target="_blank" rel="noreferrer">Pitchfork 原站 ↗</a></p>
      </details>
    </footer>}
  </div>;
}

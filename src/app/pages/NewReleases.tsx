import * as Popover from '@radix-ui/react-popover';
import { ArrowUpRight, Bookmark, Disc3, ListMusic, Play, SlidersHorizontal } from 'lucide-react';
import { appleNewReleases, formats, genreBucket, releaseWeek, currentReleaseYear, listenBrainzNewReleases, musicBrainzNewReleases, normalize, pitchforkReviews, qqRegionReleases,
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
function FilterChips({ label, options, selected, onChange }: {
  label: string; options: [string, string][]; selected: string[]; onChange: (values: string[]) => void;
}) {
  return <div className="release-control-row" role="group" aria-label={label}>
    <span>{label}</span><div className="release-chips">
      <button aria-pressed={!selected.length} onClick={() => onChange([])}>{label === '排除' ? '不排除' : '不限'}</button>
      {options.map(([key, name]) => <button key={key} aria-pressed={selected.includes(key)} onClick={() => onChange(
        selected.includes(key) ? selected.filter(value => value !== key) : [...selected, key]
      )}>{name}</button>)}
    </div>
  </div>;
}

export function NewReleases({ onOpen }: { onOpen: (item: CatalogItem) => void }) {
  const { setCurrentSong } = useMusic();
  const [feed, setFeed] = useState<Release[]>([]);
  const [source, setSource] = useState<string[]>([]);
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
  const releaseYear = currentReleaseYear();
  const [weekNumber, setWeekNumber] = useState(releaseYear.current);
  const [weekInput, setWeekInput] = useState(String(releaseYear.current));
  const week = releaseYear.current - weekNumber;
  function selectWeek(value: number) {
    const next = Number.isInteger(value) ? Math.min(releaseYear.total, Math.max(1, value)) : weekNumber;
    setPage(1);
    setWeekNumber(next);
    setWeekInput(String(next));
  }
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['专辑', 'EP']);
  const formatsKey = selectedFormats.join('|');
  const [genre, setGenre] = useState<string[]>([]);
  const [excludedGenre, setExcludedGenre] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<string[]>(['待筛选', '想听']);
  const [trackNotice, setTrackNotice] = useState<{ id: string; text: string }>();
  const [applePreviews, setApplePreviews] = useState<{ id: string; tracks: { trackId: number; trackName: string; previewUrl: string }[] }>();
  const [previewTrack, setPreviewTrack] = useState<number>();
  const [trackPanel, setTrackPanel] = useState('');
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
       ...(week >= 0 ? (['专辑', 'EP'] as const).filter(type => !formatsKey || formatsKey.split('|').includes(type))
         .map(type => ['MusicBrainz ' + type, musicBrainzNewReleases(page, type, week, signal)] as [string, Promise<Release[]>]) : []),
    ];
    if (page === 1) {
      tasks.push(['Apple 地区榜', appleNewReleases(region, signal)]);
      if (week >= 0) tasks.push(['ListenBrainz', listenBrainzNewReleases(week, signal)]);
    }
    void Promise.all(tasks.map(async ([name, task]) => {
      try {
        const entries = await task;
        if (!signal.aborted) setFeed(previous => [...new Map([...previous, ...entries].map(item => [keyOf(item), item])).values()]);
      } catch (error) {
        if (!signal.aborted) setFailed(previous => [...previous, name.startsWith('MusicBrainz')
          ? `MusicBrainz（${error instanceof Error && /^HTTP \d+$/.test(error.message) ? error.message : error instanceof Error && error.name === 'TimeoutError' ? '请求超时' : '网络连接失败'}）`
          : name]);
      }
    })).then(() => { if (!signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, retry, region, formatsKey, week]);

  const all = [...new Map([...library.items.filter(item => !item.manual), ...verifiedReleases, ...feed, ...library.items.filter(item => item.manual)].map(item => [keyOf(item), item])).values()].map(item =>
    library.tags[keyOf(item)] ? { ...item, ...library.tags[keyOf(item)] } : item);
  const { start, end, through } = releaseWeek(week);
  const genres = ['流行', '摇滚', '电子／舞曲', 'R&B／灵魂', '说唱', '爵士', '民谣', '古典', '乡村', '金属', '其他风格', '未分类'];
  const queue = all.filter(item => library.decisions[keyOf(item)] === '想听');
  const hasReview = (item: Release) => reviews.find(review =>
    normalize(review.title) === normalize(item.title) && !!item.artist &&
    normalize(new URL(review.url).pathname).includes(normalize(item.artist)));
  const sightings = new Map<string, Release[]>();
  for (const item of all) {
    const identity = releaseIdentity(item);
    sightings.set(identity, [...(sightings.get(identity) ?? []), item]);
  }
  const exactCatalogDates = new Map(all.filter(item => item.provider === 'listenbrainz' && item.date).map(item => [item.id, item.date]));
  const candidates = all.map(item => {
    const same = item.artist ? sightings.get(releaseIdentity(item)) ?? [item] : [item];
    const verified = verifiedReleases.find(entry => item.artist && releaseIdentity(entry) === releaseIdentity(item));
    const known = verified ?? same.find(entry => entry.quality === '明确标注') ??
      same.find(entry => entry.provider === 'apple' && entry.format !== '未分类');
    const review = hasReview(item);
    const preferredArt = same.find(entry => entry.provider !== 'musicbrainz' && entry.image)?.image;
    return {
      ...item, date: item.date ?? (item.provider === 'musicbrainz' ? exactCatalogDates.get(item.id) : undefined),
      image: preferredArt || review?.image || item.image, format: library.tags[keyOf(item)]?.format ?? known?.format ?? item.format,
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
    if (source.length && !source.includes(item.provider)) return false;
    if (region && (item.region ?? '其他／待确认') !== region) return false;
    if (library.hidden.includes(item.artist) || (hideAI && item.ai)) return false;
    const matchesFormat = !selectedFormats.length || selectedFormats.includes(item.format);
    const style = genreBucket(item.genre);
    const matchesWeek = item.date ? item.date >= start && item.date <= through :
      (item.manual || (week === 0 && item.format === 'EP' && selectedFormats.includes('EP')));
    return (!visibility.length || visibility.includes(discoveryDecision ?? '待筛选')) &&
      matchesWeek && matchesFormat && (!genre.length || genre.includes(style)) && !excludedGenre.includes(style);
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

  async function findPlayerAlbum(item: Release): Promise<CatalogItem | undefined> {
    if (item.provider === 'qq') return { ...item, provider: 'qq' };
    const fromFeed = sightings.get(releaseIdentity(item))?.find(entry => entry.provider === 'qq');
    if (fromFeed) return { ...fromFeed, provider: 'qq' };
    const title = item.title.replace(/\s*[-–—]\s*(EP|Single)\s*$/i, '');
    const { items } = await searchCatalog('qq', 'albums', title, 12, 1);
    return items.find((candidate: CatalogItem) => normalize(candidate.title) === normalize(title) &&
      !!item.artist && normalize(candidate.artist) === normalize(item.artist));
  }

  async function openRelease(item: Release) {
    const id = keyOf(item);
    if (item.provider === 'qq') { onOpen({ ...item, provider: 'qq' }); return; }
    setTrackPanel(id);
    setPending(id);
    setTrackNotice(undefined);
    setApplePreviews(undefined);
    setPreview(undefined);
    try {
      const catalog = await findPlayerAlbum(item);
      if (catalog) { onOpen(catalog); return; }
      setTrackNotice({ id, text: '站内曲库未找到同名同艺人的专辑，可打开来源查看曲目。' });
    } catch {
      setTrackNotice({ id, text: '暂时无法匹配站内曲库，可打开来源查看曲目。' });
    } finally { setPending(''); }
  }

  async function loadTracks(item: Release) {
    setPending(keyOf(item));
    setPreview(undefined);
    const id = keyOf(item);
    setTrackNotice(undefined);
    setApplePreviews(undefined);
    setPreviewTrack(undefined);
    try {
      if (item.provider === 'apple' && /^\d+$/.test(item.id)) {
        try {
          const country = item.externalUrl?.match(/^https:\/\/music\.apple\.com\/([a-z]{2})\//)?.[1] ?? 'us';
          const response = await fetch(`https://itunes.apple.com/lookup?id=${item.id}&entity=song&country=${country}`, { signal: AbortSignal.timeout(4000) });
          if (!response.ok) throw new Error('Apple lookup unavailable');
          const { results } = await response.json();
          const tracks = results?.filter((track: { collectionId: number; trackId: number; previewUrl?: string }) =>
            String(track.collectionId) === item.id && track.trackId && track.previewUrl?.startsWith('https://'));
          if (tracks?.length) { setApplePreviews({ id, tracks }); return; }
        } catch { /* The QQ catalogue is an independent fallback. */ }
      }
      const catalog = await findPlayerAlbum(item);
      if (!catalog) { setTrackNotice({ id, text: '未找到可试听曲目，可打开发行资料。' }); return; }
      const detail = await getCatalogDetail(catalog);
      if (!detail.songs.length) throw new Error('Empty tracks');
      setPreview(detail);
    } catch { setTrackNotice({ id, text: '暂时无法读取曲目，请重试或打开原平台。' }); }
    finally { setPending(''); }
  }

  return <div className="new-releases">
    <header className="release-hero"><div>
      <h2>新专辑 / EP 发现</h2><p>从地区新发行与编辑推荐里，挑出下一张想听的专辑。</p></div>
      <div className="release-toolbar"><button aria-pressed={!saved} onClick={() => setSaved(false)}>浏览新碟</button><button aria-pressed={saved} onClick={() => setSaved(true)}>已收藏</button></div></header>
    {!saved && <>
      <section className="release-controls" aria-label="筛选发行">
        <FilterChips label="类型" options={formats.map(type => [type, type])} selected={selectedFormats}
          onChange={values => { setPage(1); setSelectedFormats(values); }} />
        <div className="release-control-row"><span>地区</span><div className="release-chips">
          {(['', ...regions] as const).map(value => <button key={value}
            aria-pressed={region === value} onClick={() => { setPage(1); setRegion(value); }}>{value || '全部地区'}</button>)}
        </div></div>
        <FilterChips label="来源" options={Object.entries(sourceNames)} selected={source} onChange={setSource} />
        <FilterChips label="风格" options={genres.map(name => [name, name])} selected={genre} onChange={values => {
          setGenre(values); setExcludedGenre(current => current.filter(value => !values.includes(value)));
        }} />
        <FilterChips label="排除" options={genres.map(name => [name, name])} selected={excludedGenre} onChange={values => {
          setExcludedGenre(values); setGenre(current => current.filter(value => !values.includes(value)));
        }} />
        <FilterChips label="状态" options={['待筛选', '想听', '跳过', '已收藏'].map(name => [name, name])} selected={visibility} onChange={setVisibility} />
        <div className="release-control-row"><span>发行周</span><div className="release-chips">
          <span>{releaseYear.year} 年第</span>
          <div className="release-week-input">
            <button aria-label="上一周" disabled={weekNumber === 1} onClick={() => selectWeek(weekNumber - 1)}>‹</button>
            <input aria-label="发行周周数" type="text" inputMode="numeric" maxLength={2} value={weekInput}
              onChange={event => setWeekInput(event.target.value.replace(/\D/g, ''))}
              onBlur={() => selectWeek(weekInput.trim() ? Number(weekInput) : weekNumber)}
              onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
            <button aria-label="下一周" disabled={weekNumber === releaseYear.total} onClick={() => selectWeek(weekNumber + 1)}>›</button>
          </div><span>周</span>
          <small>{start} 至 {end}</small>
        </div></div>
        <div className="release-controls-footer">
          <div className="release-chips">
            <label>排序<select value={priority} onChange={event => setPriority(event.target.value)}><option value="curated">优先有推荐依据</option><option value="latest">按发行时间</option></select></label>
            <button aria-pressed={hideAI} onClick={() => setHideAI(value => !value)}>隐藏已标注 AI</button>
          </div>
          <button className="release-primary" disabled={!queue.length} onClick={() => setLibrary(previous => ({ ...previous,
            decisions: Object.fromEntries(Object.entries(previous.decisions).map(([id, value]) => [id, value === '想听' ? '已收藏' : value])) }))}>
            <Bookmark size={14} aria-hidden="true" /> 收藏想听（{queue.length}）
          </button>
        </div>
      </section>
      <div className="release-utilities">
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
      <h3>{selectedFormats.length === 1 ? selectedFormats[0] : '发行列表'} <small>{visible.length}</small></h3>
      <p role="status">{loading ? '正在补全发行资料…' : ''}{failed.length ? ` ${failed.join('、')}暂不可用。` : ''}</p>
    </div>}
    <div className="release-grid">{(saved ? visible : visible.slice(0, page * 60)).map(item => {
      const id = keyOf(item);
      const decision = saved ? library.decisions[id] : decisionFor(item);
      return <article key={id} className="release-card">
        <button type="button" className="release-art" disabled={!!pending} aria-label={`打开 ${item.title} 的专辑曲目`} onClick={() => void openRelease(item)}><Disc3 size={40} aria-hidden="true" />
          {item.image && <img key={item.image} src={item.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} />}
        </button>
        <div className="release-meta">
          <small className="release-origin">{item.manual ? '手动补录' : sourceNames[item.provider]} · {item.date || (item.dateHint ? item.dateHint + ' · 日期待确认' : '日期待确认')}</small>
          <h3 title={item.title}>{item.title}</h3><p title={item.artist}>{item.artist}</p>
          <div className="release-badges">
            {item.format !== '未分类' && <span className="release-tag">{item.format}</span>}
            {item.region && <span className="release-tag release-region">{item.region}</span>}
            {item.review ? <a className="release-tag" href={item.review.url} target="_blank" rel="noreferrer">Pitchfork 评论 ↗</a>
              : null}
            {item.ai && <span className="release-tag">来源标注 AI</span>}
          </div>
        </div>
        <div className="release-toolbar release-card-actions">
          <Popover.Root open={trackPanel === id} onOpenChange={open => {
            if (open) { setTrackPanel(id); void loadTracks(item); }
            else setTrackPanel(value => value === id ? '' : value);
          }}>
            <Popover.Trigger asChild><button className="release-play" disabled={!!pending}>
              <Play size={13} /> 试听
            </button></Popover.Trigger>
            <Popover.Portal><Popover.Content className="release-preview-popover" side="right" align="start" sideOffset={8}
              collisionPadding={12} aria-label={`${item.title} · 试听曲目`} onOpenAutoFocus={event => event.preventDefault()}>
              <div className="release-preview-heading"><div><strong>{item.title}</strong><p>选择试听曲目</p></div>
                <Popover.Close aria-label="关闭试听">×</Popover.Close></div>
              {pending === id && <p role="status">正在读取曲目…</p>}
              {trackNotice?.id === id && <p role="status">{trackNotice.text}</p>}
              {preview && <ol>{preview.songs.map(song => <li key={song.songmid}>
                <button onClick={() => setCurrentSong(song)}>▶ {song.songname}</button>
              </li>)}</ol>}
              {applePreviews?.id === id && <>
                <ol>{applePreviews.tracks.map(track => <li key={track.trackId}>
                  <button onClick={() => setPreviewTrack(track.trackId)}>▶ {track.trackName}</button>
                </li>)}</ol>
                {previewTrack && <audio key={previewTrack} controls autoPlay src={applePreviews.tracks.find(track => track.trackId === previewTrack)?.previewUrl} />}
              </>}
              {item.externalUrl && <a href={item.externalUrl} target="_blank" rel="noreferrer">打开发行资料 ↗</a>}
            </Popover.Content></Popover.Portal>
          </Popover.Root>
          {!saved && !decision && <><button className="release-quiet" onClick={() => decide(item, '想听')}><Bookmark size={15} /> 想听</button><button className="release-quiet" onClick={() => decide(item, '跳过')}>跳过</button></>}
          {saved && (item.provider !== 'qq'
            ? <a href={item.externalUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> 发行资料</a>
            : <button className="release-quiet" onClick={() => onOpen({ ...item, provider: 'qq' })}><ListMusic size={15} /> 详情</button>)}
          {decision && <button className="release-quiet" onClick={() => decide(item)}>{decision} · 撤销</button>}
        </div>
        {!saved && <details className="release-classify"><summary>分类与来源</summary>
          <div className="release-toolbar">
          {item.provider !== 'qq'
            ? <a href={item.externalUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={15} /> 发行资料</a>
            : <button className="release-quiet" onClick={() => onOpen({ ...item, provider: 'qq' })}><ListMusic size={15} /> 详情</button>}
            <label>类型<select value={item.format} onChange={e => { const value = e.target.value as Format; setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: value, genre: item.genre, region: item.region } } })); }}>{formats.map(value => <option key={value}>{value}</option>)}</select></label>
            <label>风格<input value={item.genre === '未分类' ? '' : item.genre} placeholder="未分类" onChange={e => { const value = e.target.value; setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: item.format, genre: value || '未分类', region: item.region } } })); }} /></label>
            <label>地区<select value={item.region ?? '其他／待确认'} onChange={event => {
              const value = event.target.value as Region;
              setLibrary(previous => ({ ...previous, tags: { ...previous.tags, [id]: { format: item.format, genre: item.genre, region: value } } }));
            }}>{regions.map(value => <option key={value}>{value}</option>)}</select></label>
            {item.chartRank && <small>Apple 地区榜收录</small>}
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

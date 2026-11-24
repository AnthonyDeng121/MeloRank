import { resolveGrammyCover } from '../services/grammyArtwork';
import { AwardWorkSearch } from '../components/AwardWorkSearch';
import React, { useEffect, useRef, useState } from 'react';
import { Award as AwardIcon, Download } from 'lucide-react';
import { grammyEditions, grammyYear, grammyCover, loadGrammyCategories, type GrammyCategory } from '../services/grammyNominees';
import { toast } from 'sonner';
import '../../styles/YearlyAwards.css';

const modes = { custom: '自定义奖项', grammy: '格莱美获奖预测' } as const;
type Mode = keyof typeof modes;
const categories = { lyrics: ['歌词', '作词'], melody: ['旋律', '作曲'], production: ['制作', '制作人'], song: ['歌曲', ''], album: ['专辑', ''], collaboration: ['合作', ''], cover: ['封面', '封面设计'] } as const;
type Category = keyof typeof categories;
const themes = { gold: '赤金', silver: '午夜银', green: '松石绿', violet: '暮紫' } as const;
type Theme = keyof typeof themes;
type Work = { id: string; title: string; artist: string; credits: Partial<Record<Category, string>>; cover: string };
type Award = { id: string; title: string; category: Category; works: Work[]; winner: string; reason: string; preference?: string; scope?: Scope; official?: GrammyCategory };
type Edition = { name: string; year: string; theme: Theme; awards: Award[]; selected: string; presetScopesAdded?: boolean };
const storageKey = 'melorank-yearly-awards-v1';
const categoryKeys = Object.keys(categories) as Category[];
const scopes = ['K-pop', '华语', '欧美', '通类'] as const;
type Scope = typeof scopes[number];
const presetTitle = (scope: Scope, category: Category) =>
  scope === '通类' && (category === 'collaboration' || category === 'cover')
    ? '最佳' + categories[category][0]
    : (scope === '通类' ? '' : scope) + '年度' + categories[category][0];
const newAward = (title: string, category: Category): Award => ({
  id: crypto.randomUUID(), title, category, works: [], winner: '', reason: '',
});
function officialEdition(categories: GrammyCategory[], year: string, previous?: Edition): Edition {
  const awards: Award[] = categories.map(official => {
    const saved = previous?.year === year ? previous.awards.find(item => item.id === official.id) : undefined;
    const works: Work[] = official.nominees.map(([id, title, artist]) => ({
      id, title, artist, credits: {}, cover: year === grammyYear ? grammyCover(title) : '',
    }));
    const restore = (value?: string) => works.find(work => work.id === value ||
      work.title.toLowerCase() === value?.toLowerCase())?.id ?? '';
    return { id: official.id, title: official.title, category: 'song', works, official,
      reason: saved?.reason ?? '', winner: restore(saved?.winner), preference: restore(saved?.preference) };
  });
  return { name: '格莱美获奖预测', year, theme: previous?.theme ?? 'gold', awards,
    selected: awards.find(item => item.id === previous?.selected)?.id ?? awards[0]?.id ?? '' };
}
function customEdition(previous?: Edition): Edition {
  if (previous?.presetScopesAdded) return { ...previous, awards: previous.awards.map(item =>
    item.scope ? { ...item, title: presetTitle(item.scope, item.category) } : item) };
  const saved = previous?.awards ?? [];
  const adopted = new Set<string>();
  const presets = scopes.flatMap(scope => categoryKeys.map(category => {
    const title = presetTitle(scope, category);
    const existing = saved.find(item => (item.title === title || item.title === title + '奖' || (scope === '通类' && [title, title + '奖'].some(name => item.title === '通类' + name))) && !adopted.has(item.id));
    if (existing) adopted.add(existing.id);
    return { ...(existing ?? newAward(title, category)), title, category, scope };
  }));
  const awards = [...presets, ...saved.filter(item => !adopted.has(item.id))];
  return { name: 'MeloRank 音乐奖', year: String(new Date().getFullYear()), theme: 'gold',
    selected: awards[0].id, ...previous, awards, presetScopesAdded: true };
}
function editionYears(saved: string) {
  const latest = new Date().getFullYear() + 1;
  const years = Array.from({ length: latest - 1899 }, (_, index) => String(latest - index));
  return saved && !years.includes(saved) ? [saved, ...years] : years;
}
type SavedAwards = { custom: Edition; grammyByYear: Record<string, Edition> };
function readEditions(): SavedAwards {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved) return { custom: customEdition(saved.custom),
      grammyByYear: saved.grammyByYear ?? (saved.grammy ? { [saved.grammy.year]: saved.grammy } : {}) };
  } catch { /* A missing or unreadable draft starts a fresh edition. */ }
  return { custom: customEdition(), grammyByYear: {} };
}
async function coverData(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(640, side);
    canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.78);
  } finally { bitmap.close(); }
}
function Cover({ work }: { work?: Work }) {
  return work?.cover ? <img onError={event => { event.currentTarget.style.visibility = 'hidden'; }} key={work.cover} src={work.cover} alt="" /> : <span className="award-cover-empty" aria-hidden="true">♪</span>;
}

export function YearlyAwards() {
  const [mode, setMode] = useState<Mode>('custom');
  const [editions, setEditions] = useState(readEditions);
  const [editionYear, setEditionYear] = useState(grammyYear as string);
  const [loaded, setLoaded] = useState<{ year: string; categories: GrammyCategory[] }>();
  const [grammyError, setGrammyError] = useState(false);
  const [grammyRetry, setGrammyRetry] = useState(0);
  const [awardKind, setAwardKind] = useState('');
  const activeGrammy = grammyEditions.find(item => item.year === editionYear) ?? grammyEditions[0];
  useEffect(() => {
    if (mode !== 'grammy' || loaded?.year === editionYear) return;
    const controller = new AbortController();
    setGrammyError(false);
    void loadGrammyCategories(editionYear, controller.signal).then(categories => {
      if (!controller.signal.aborted) setLoaded({ year: editionYear, categories });
    }).catch(() => { if (!controller.signal.aborted) setGrammyError(true); });
    return () => controller.abort();
  }, [mode, editionYear, loaded, grammyRetry]);
  const [savingFailed, setSavingFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const poster = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = poster.current;
    if (!frame || !element) return;
    const resize = () => {
      const availableHeight = Math.max(250, window.innerHeight - 265);
      const scale = Math.min(frame.clientWidth / 1024, availableHeight / element.offsetHeight);
      frame.style.setProperty('--poster-width', Math.round(1024 * scale) + 'px');
      frame.style.setProperty('--poster-scale', String(scale));
      frame.style.height = Math.ceil(element.offsetHeight * scale) + 'px';
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame);
    observer.observe(element);
    window.addEventListener('resize', resize);
    resize();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [frame]);
  const edition = mode === 'custom' ? editions.custom : officialEdition(
    loaded?.year === editionYear ? loaded.categories : [], editionYear, editions.grammyByYear[editionYear]);

  const award = edition.awards.find(item => item.id === edition.selected) ?? edition.awards[0];
  const awardField = award?.official?.field ?? '';
  const fieldAwards = edition.awards.filter(item => item.official?.field === awardField);
  const kinds = [...new Set(fieldAwards.map(item => item.official?.kind ?? ''))].filter(Boolean);
  const official = mode === 'grammy' ? award?.official : undefined;
  const [artwork, setArtwork] = useState<Record<string, string>>({});
  const [artworkLoading, setArtworkLoading] = useState(false);
  useEffect(() => {
    setArtwork({});
    setArtworkLoading(false);
    if (!official || official.kind === '艺人与个人') return;
    const missing = official.nominees.filter(([, title, artist]) => artist && (editionYear !== grammyYear || !grammyCover(title)));
    if (!missing.length) return;
    const controller = new AbortController();
    const urls: string[] = [];
    setArtworkLoading(true);
    void (async () => {
      for (const [id, title, artist] of missing) {
        if (controller.signal.aborted) break;
        const blob = await resolveGrammyCover(title, artist, controller.signal).catch(() => null);
        if (!blob || controller.signal.aborted) continue;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setArtwork(value => ({ ...value, [id]: url }));
      }
      if (!controller.signal.aborted) setArtworkLoading(false);
    })();
    return () => {
      controller.abort();
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [official, editionYear]);
  const withCover = (work?: Work) => work && !work.cover && artwork[work.id] ? { ...work, cover: artwork[work.id] } : work;

  const winner = award?.works.find(work => work.id === award.winner);
  const preference = award?.works.find(work => work.id === award.preference);
  const customAwards = editions.custom.awards.filter(item => !item.scope);
  const workName = (work: Work) => work.title.trim() || '未命名作品';
  const credit = award ? categories[award.category][1] : '';
  const resultLabel = mode === 'grammy' ? '预测获奖' : '获奖';

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(editions));
      setSavingFailed(false);
    } catch { setSavingFailed(true); }
  }, [editions]);

  const editEdition = (update: (current: Edition) => Edition) =>
    setEditions(current => {
      if (mode === 'custom') return { ...current, custom: update(current.custom) };
      const currentEdition = officialEdition(loaded?.year === editionYear ? loaded.categories : [], editionYear, current.grammyByYear[editionYear]);
      const next = update(currentEdition);
      return { ...current, grammyByYear: { ...current.grammyByYear, [editionYear]: {
        ...next, awards: next.awards.filter(item => item.winner || item.preference || item.reason)
          .map(({ official, ...item }) => ({ ...item, works: [] })),
      } } };
    });
  const editAward = (update: (current: Award) => Award) => {
    if (!award) return;
    editEdition(current => ({
      ...current, awards: current.awards.map(item => item.id === award.id ? update(item) : item),
    }));
  };
  const editWork = (id: string, patch: Partial<Work>) =>
    editAward(current => ({ ...current, works: current.works.map(work => work.id === id ? { ...work, ...patch } : work) }));

  async function download() {
    if (!poster.current || !award) return;
    const element = poster.current;
    setExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      await document.fonts.ready;
      const canvas = await html2canvas(element, {
        scale: 1, width: 1024, useCORS: true,
        windowWidth: 1600, backgroundColor: null,
        onclone: (_, cloned) => {
          cloned.style.cssText = 'position:static;transform:none';
          const frame = cloned.parentElement!;
          frame.style.cssText = 'width:1024px;height:auto;overflow:visible;';
        },
      });
      const link = document.createElement('a');
      link.download = [edition.year, award.title || '年度奖项'].join('-').replace(/[\\/:*?"<>|]/g, '-') + '.png';
      link.href = canvas.toDataURL('image/png');
      if (link.href === 'data:,') throw new Error('Canvas size exceeded');
      link.click();
    } catch { toast.error('海报导出失败，请重试或减少提名数量'); }
    finally { setExporting(false); }
  }

  return <div className="yearly-awards">
    <header className="awards-header">
      <div className="awards-title"><AwardIcon aria-hidden="true" /><div><h2>年度奖项</h2><p>管理提名、预测结果与海报。</p></div></div>
      <div className="awards-modes" role="group" aria-label="奖项模式">
        {(Object.keys(modes) as Mode[]).map(key => <button key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>{modes[key]}</button>)}
      </div>
    </header>
    <div className="awards-layout">
      <section className="awards-editor" aria-label="奖项编辑">
        {mode === 'custom' ? <div className="awards-fields">
          <label>奖项总名称<input value={edition.name} onChange={event => editEdition(value => ({ ...value, name: event.target.value }))} /></label>
          <label>届次年份<select value={edition.year} onChange={event => editEdition(value => ({ ...value, year: event.target.value }))}>
            {edition.year === '' && <option value="" disabled>选择年份</option>}
            {editionYears(edition.year).map(year => <option key={year}>{year}</option>)}
          </select></label>
        </div> : <div className="awards-source">
          <label>格莱美届次<select value={editionYear} onChange={event => { setEditionYear(event.target.value); setAwardKind(''); }}>
            {grammyEditions.map(item => <option key={item.year} value={item.year}>{item.year} · 第 {item.number} 届</option>)}
          </select></label>
          <a href={activeGrammy.source} target="_blank" rel="noreferrer">查看官方提名 ↗</a>
        </div>}
        {mode === 'grammy' ? (award ? <>
          <div className="awards-fields">
            <label>奖项分组<select value={awardField} onChange={event => {
              const field = event.target.value;
              setAwardKind('');
              editEdition(value => ({ ...value, selected: value.awards.find(item => item.official?.field === field)!.id }));
            }}>{[...new Set(edition.awards.map(item => item.official?.field))].map(field => <option key={field}>{field}</option>)}</select></label>
            <label>作品形式<select value={awardKind} onChange={event => {
              const kind = event.target.value;
              setAwardKind(kind);
              if (kind && award.official?.kind !== kind) {
                editEdition(value => ({ ...value, selected: fieldAwards.find(item => item.official?.kind === kind)!.id }));
              }
            }}><option value="">全部</option>{kinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
          </div>
          <label>选择奖项<select value={award.id} onChange={event => editEdition(value => ({ ...value, selected: event.target.value }))}>
            {fieldAwards.filter(item => !awardKind || item.official?.kind === awardKind).map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select></label>
        </> : grammyError ? <button onClick={() => setGrammyRetry(value => value + 1)}>名单加载失败，重试</button> : <p role="status">正在加载官方提名…</p>) : <>
          <div className="awards-fields">
            <label>音乐范围<select value={award?.scope ?? ''} onChange={event => {
              const scope = event.target.value;
              editEdition(value => ({ ...value, selected: value.awards.find(item => item.scope === scope && item.category === award?.category)?.id
                ?? value.awards.find(item => item.scope === scope)!.id }));
            }}>
              {!award?.scope && <option value="" disabled>自定义奖项</option>}
              {scopes.map(scope => <option key={scope}>{scope}</option>)}
            </select></label>
            {award?.scope && <label>评奖维度<select value={award.category} onChange={event => {
              const category = event.target.value;
              editEdition(value => ({ ...value, selected: value.awards.find(item => item.scope === award.scope && item.category === category)!.id }));
            }}>
              {categoryKeys.map(key => <option key={key} value={key}>{categories[key][0]}</option>)}
            </select></label>}
          </div>
          <div className="awards-actions">
            {customAwards.length > 0 && <label>已创建的自定义奖项<select value={award?.scope ? '' : award?.id} onChange={event => editEdition(value => ({ ...value, selected: event.target.value }))}>
              <option value="" disabled>选择自定义奖项</option>
              {customAwards.map(item => <option key={item.id} value={item.id}>{item.title || '未命名奖项'}</option>)}
            </select></label>}
            <button onClick={() => {
              const item = newAward('', 'song');
              editEdition(value => ({ ...value, awards: [...value.awards, item], selected: item.id }));
            }}>＋ 自定义奖项</button>
          </div>
          {award?.scope && <h3>{award.title}</h3>}
        </>}
        {award && <>
          {mode === 'custom' && !award.scope && <div className="awards-fields">
            <label>奖项名称<input value={award.title} onChange={event => editAward(value => ({ ...value, title: event.target.value }))} /></label>
            <label>奖项类型<select value={award.category} onChange={event => editAward(value => ({ ...value, category: event.target.value as Category }))}>
              {categoryKeys.map(key => <option key={key} value={key}>{categories[key][0]}</option>)}
            </select></label>
          </div>}
          <label>{resultLabel}理由<textarea rows={2} value={award.reason} onChange={event => editAward(value => ({ ...value, reason: event.target.value }))} /></label>
          <label>{mode === 'grammy' ? 'Will Win · 预测获奖' : '获奖作品'}<select value={award.winner} onChange={event => editAward(value => ({ ...value, winner: event.target.value }))}>
            <option value="">待定</option>
            {award.works.map(work => <option key={work.id} value={work.id}>{workName(work)}{work.artist && ' · ' + work.artist}</option>)}
          </select></label>
          {mode === 'grammy' && <label>Should Win · 心中最佳<select value={award.preference ?? ''} onChange={event => editAward(value => ({ ...value, preference: event.target.value }))}>
            <option value="">待定</option>
            {award.works.map(work => <option key={work.id} value={work.id}>{work.title} · {work.artist}</option>)}
          </select></label>}
          {mode === 'grammy' ? <div className="awards-official">
            <h3>官方提名 <small>{award.works.length}</small></h3>
            <ul>{award.works.map(work => <li key={work.id} data-picked={work.id === award.winner}>
              <strong>{work.title}</strong><span>{work.artist}</span>
            </li>)}</ul>
          </div> : <>
          <div className="awards-actions">
            <h3>提名作品 <small>{award.works.length}</small></h3>
            <button className="award-primary" onClick={() => {
              const work: Work = { id: crypto.randomUUID(), title: '', artist: '', credits: {}, cover: '' };
              editAward(value => ({ ...value, works: [...value.works, work] }));
            }}>添加提名</button>
          </div>
          {award.works.map((work, index) => <fieldset key={work.id} className="awards-nomination">
            <legend>提名 {index + 1}</legend>
            <AwardWorkSearch key={award.category} album={award.category === 'album'}
              onSelect={({ title, artist, cover, credits }) => editWork(work.id, { title, artist, cover, credits: credits ?? {} })} />
            <div className="awards-fields">
              <label>作品名称<input value={work.title} onChange={event => editWork(work.id, { title: event.target.value })} /></label>
              <label>艺人<input value={work.artist} onChange={event => editWork(work.id, { artist: event.target.value })} /></label>
            </div>
            {credit && <label>{credit}<input value={work.credits[award.category] ?? ''} onChange={event => editWork(work.id, { credits: { ...work.credits, [award.category]: event.target.value } })} /></label>}
            <div className="awards-nomination-actions">
              <label className="award-upload"><span>{work.cover ? '更换封面' : '上传封面'}</span><input aria-label="上传封面" type="file" accept="image/*" onChange={async event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                try { editWork(work.id, { cover: await coverData(file) }); }
                catch { toast.error('无法读取封面，请选择有效的图片'); }
              }} /></label>
              {work.cover && <button className="award-text-action" onClick={() => editWork(work.id, { cover: '' })}>清除封面</button>}
              <button className="award-text-action award-delete" onClick={() => editAward(value => ({ ...value, works: value.works.filter(item => item.id !== work.id), winner: value.winner === work.id ? '' : value.winner }))}>移除提名</button>
            </div>
          </fieldset>)}
          {!award.scope && <button className="award-text-action award-delete" onClick={() => {
            if (!window.confirm('删除这个奖项及其提名？')) return;
            editEdition(value => ({ ...value, awards: value.awards.filter(item => item.id !== award.id), selected: '' }));
          }}>删除当前奖项</button>}
          </>}
        </>}
        <p role="status" className={savingFailed ? 'award-delete' : 'award-saved'}>
          {savingFailed ? '浏览器存储写入失败，请减少封面数量或检查存储权限。' : '草稿自动保存在当前浏览器'}
        </p>
      </section>
      <section className="awards-preview" aria-label="海报预览">
        <div className="awards-actions">
          <label>海报色调<select value={edition.theme} onChange={event => editEdition(value => ({ ...value, theme: event.target.value as Theme }))}>
            {(Object.keys(themes) as Theme[]).map(key => <option key={key} value={key}>{themes[key]}</option>)}
          </select></label>
          <button className="awards-download" disabled={!award || exporting} onClick={() => void download()}><Download size={16} aria-hidden="true" />{exporting ? '正在导出…' : '下载 PNG'}</button>
        </div>
        {mode === 'grammy' && artworkLoading && <p role="status" className="award-saved">正在查找缺失封面，可先预览或导出。</p>}
        {award && <div ref={setFrame} className="award-poster-frame"><article ref={poster} className="award-poster" data-theme={edition.theme}>
          {mode === 'grammy' ? <div className="grammy-poster">
            <div className="grammy-rule">GRAMMY AWARDS · 第 {activeGrammy.number} 届 / {edition.year}</div>
            <h3>BITCHFUCK 格莱美预测</h3>
            <div className="grammy-category">{award.title} {award.official?.english !== award.title && <i>{award.official?.english}</i>}</div>
            <div className="grammy-picks">
              {([['will win', winner], ['should win', preference]] as const).map(([label, work]) => <div key={label}>
                <h4>{label}</h4><div className="grammy-art"><Cover work={withCover(work)} /></div>
                <strong>{work?.title || '待定'}</strong><p>{work?.artist}</p>
              </div>)}
            </div>
            {award.reason.trim() && <div className="award-reason"><strong>预测理由</strong><span>{award.reason}</span></div>}
            <div className="grammy-rule grammy-nominees-title">完整提名</div>
            <ol className="grammy-grid" data-count={award.works.length}>
              {award.works.map(work => <li key={work.id}>
                <div className="grammy-art"><Cover work={withCover(work)} /></div>
                <strong>{work.title}</strong><p>{work.artist}</p>
              </li>)}
            </ol>
          </div> : <>
          <div className="award-poster-heading"><span>{edition.year} {edition.name || modes[mode]}</span></div>
          <div className="award-feature">
            <div className="award-feature-cover"><Cover work={winner} /></div>
            <div className="award-feature-copy">
              <h3>{award.title || '未命名奖项'}</h3>
              <div className="award-result-label">{resultLabel}作品</div>
              <h4>{winner ? workName(winner) : '待定'}</h4>
              {winner?.artist && <p>{winner.artist}</p>}
              {credit && winner?.credits[award.category] && <div className="award-credit">{credit}：{winner.credits[award.category]}</div>}
            </div>
          </div>
          {award.reason.trim() && <div className="award-reason"><strong>{resultLabel}理由</strong><span>{award.reason}</span></div>}
          <h3 className="award-poster-heading"><span>完整提名名单</span></h3>
          {award.works.length ? <ol className="award-poster-list">
            {award.works.map(work => <li key={work.id}>
              <Cover work={work} />
              <div><strong>{workName(work)}{work.artist && ' · ' + work.artist}</strong>
                {credit && work.credits[award.category] && <div className="award-credit">{credit}：{work.credits[award.category]}</div>}
              </div>
              {work.id === award.winner && <span className="award-winner-mark">{resultLabel}</span>}
            </li>)}
          </ol> : <p className="award-empty">暂无提名</p>}
          </>}
        </article></div>}
      </section>
    </div>
  </div>;
}

import { qqMusicService } from './qqMusicService';

export const regions = ['华语', 'K-pop', '欧美', '日语', '其他／待确认'] as const;
export type Region = typeof regions[number];
export const formats = ['专辑', 'EP', '单曲', '原声带', '精选', '现场', '豪华版／再版', '其他发行', '未分类'] as const;
export type Format = typeof formats[number];
export type ReleaseSource = 'qq' | 'apple' | 'musicbrainz';
export type Release = {
  provider: ReleaseSource; kind: 'albums'; id: string; title: string; artist: string; image: string;
  date?: string; dateHint?: string; format: Format; genre: string; region?: Region;
  externalUrl?: string; manual?: boolean; ai?: boolean; chartRank?: number; quality?: '明确标注' | '按曲目推断';
};
export const sourceNames: Record<ReleaseSource, string> = { qq: 'QQ 音乐', apple: 'Apple Music', musicbrainz: 'MusicBrainz' };
export const releaseKey = (item: Release) => item.provider + ':' + item.id;
export const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '');
const baseTitle = (title: string) => title.replace(/\s*[-–—]\s*(EP|Single)\s*$/i, '');
export const releaseIdentity = (item: Release) => normalize(baseTitle(item.title)) + ':' + normalize(item.artist);
export function titleFormat(title: string): Format {
  if (/原声带|soundtrack|original (motion picture|television|game) score/i.test(title)) return '原声带';
  if (/豪华版|再版|deluxe|reissue|anniversary edition|remaster/i.test(title)) return '豪华版／再版';
  if (/精选|greatest hits|compilation/i.test(title)) return '精选';
  if (/现场版|live at|live in|\(live\)/i.test(title)) return '现场';
  if (/(?:^|[\s\-（(])E\.?P\.?\b/i.test(title)) return 'EP';
  if (/\bSingle\s*\)?$|单曲版/i.test(title)) return '单曲';
  if (/\bremixes?\b|混音版|mixtape/i.test(title)) return '其他发行';
  return '未分类';
}
function inferFormat(title: string, count: number, durations: number[] = []): Format {
  const explicit = titleFormat(title);
  if (explicit !== '未分类') return explicit;
  if (count === 1) return '单曲';
  if (count >= 4 && count <= 6 && durations.length === count &&
      durations.every(value => Number.isFinite(value) && value > 0 && value < 600) &&
      durations.reduce((sum, value) => sum + value, 0) <= 1800) return 'EP';
  if (count >= 7) return '专辑';
  return '未分类';
}
function inferredRegion(genre: string): Region | undefined {
  if (/k[ -]?pop|korean pop|韩国流行/i.test(genre)) return 'K-pop';
  if (/mandopop|cantopop|华语|国语流行/i.test(genre)) return '华语';
  if (/j[ -]?pop|japanese pop/i.test(genre)) return '日语';
}
const appleMarkets: Record<string, Region> = { cn: '华语', tw: '华语', kr: 'K-pop', us: '欧美', jp: '日语' };
const qqMarkets: Record<number, Region> = { 1: '华语', 2: '华语', 3: '欧美', 4: 'K-pop', 5: '日语' };

export function releaseWeek(weeksAgo: number, now = new Date()) {
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const friday = new Date(today + 'T00:00:00Z');
  friday.setUTCDate(friday.getUTCDate() - (friday.getUTCDay() + 2) % 7 - weeksAgo * 7);
  const thursday = new Date(friday);
  thursday.setUTCDate(thursday.getUTCDate() + 6);
  const start = friday.toISOString().slice(0, 10);
  const end = thursday.toISOString().slice(0, 10);
  return { start, end, through: end < today ? end : today };
}

export function genreBucket(tag: string) {
  if (/k[ -]?pop|j[ -]?pop|c[ -]?pop|mandopop|cantopop|korean pop|japanese pop|华语|韩国流行|国语流行/i.test(tag)) return '流行';
  const genres: [RegExp, string][] = [
    [/metal|金属/i, '金属'], [/hip.hop|rap|说唱/i, '说唱'], [/r&b|soul|灵魂|节奏布鲁斯/i, 'R&B／灵魂'],
    [/rock|摇滚/i, '摇滚'], [/electronic|dance|电子|舞曲/i, '电子／舞曲'], [/jazz|爵士/i, '爵士'],
    [/folk|民谣/i, '民谣'], [/classical|古典/i, '古典'], [/country|乡村/i, '乡村'], [/pop|流行/i, '流行'],
  ];
  return genres.find(([pattern]) => pattern.test(tag))?.[1] ?? (tag === '未分类' ? tag : '其他风格');
}

function dateRange(days: number) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days + 1);
  return [start.toLocaleDateString('sv-SE'), now.toLocaleDateString('sv-SE')];
}
const withTimeout = (signal: AbortSignal) => AbortSignal.any([signal, AbortSignal.timeout(12000)]);

interface QQAlbum {
  mid: string;
  name: string;
  singers?: {name: string}[];
  release_time?: string;
  str_genre?: string;
}
export async function qqRegionReleases(region: Region | '', page: number, signal: AbortSignal): Promise<Release[]> {
  const areas = Object.entries(qqMarkets).filter(([, value]) => !region || value === region);
  const results = await Promise.allSettled(areas.map(async ([area, value]) => {
    const result = await qqMusicService.getNewAlbums(region ? 16 : 8, page, Number(area));
    const rows: QQAlbum[] = (result.body ?? result).response?.new_album?.data?.albums;
    if (!Array.isArray(rows)) throw new Error('Missing QQ releases');
    return rows.filter(row => row.mid && row.name).map((row): Release => ({
      id: row.mid, title: row.name, artist: (row.singers ?? []).map(artist => artist.name).join(' / '),
      provider: 'qq', kind: 'albums', region: value,
      image: `https://y.qq.com/music/photo_new/T002R300x300M000${row.mid}.jpg`,
      date: row.release_time, format: titleFormat(row.name), genre: row.str_genre?.trim() || '未分类',
    }));
  }));
  if (areas.length && results.every(result => result.status === 'rejected')) throw new Error('QQ unavailable');
  const entries = [...new Map(results.flatMap(result => result.status === 'fulfilled' ? result.value : []).map(item => [item.id, item])).values()];
  // A bounded worker pool enriches candidates with detail fields omitted by QQ's list.
  const candidates = entries.filter(item => item.format === '未分类');
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (!signal.aborted && next < candidates.length) {
      const item = candidates[next++];
      try {
        const result = await qqMusicService.catalogRequest('/getAlbumInfo', { albummid: item.id });
        const response = (result.body ?? result).response ?? result;
        const info = response.data ?? response;
        const durations = Array.isArray(info.list) ? info.list.map((song: { interval?: number }) => Number(song.interval)) : [];
        item.format = inferFormat(item.title, Number(info.total_song_num), durations);
        if (item.format !== '未分类') item.quality = '按曲目推断';
        item.genre = info.genre?.trim() || item.genre;
      } catch { /* Keep uncertain metadata out of the primary shelf. */ }
    }
  }));
  return entries;
}

// Verified catalogue entries can fill gaps in the regional chart without treating it as exhaustive.
export const verifiedReleases: Release[] = [
  { provider: 'apple', kind: 'albums', id: '6835801718', title: 'Gleam Hour', artist: 'WENDY',
    date: '2026-11-23', format: 'EP', region: 'K-pop', genre: '未分类', image: '',
    externalUrl: 'https://music.apple.com/us/album/gleam-hour-ep/6835801718', quality: '明确标注' },
  { provider: 'apple', kind: 'albums', id: '6822634780', title: 'Cute & Anxiety', artist: 'Yves',
    date: '2026-11-20', format: 'EP', region: 'K-pop', genre: '未分类', image: '',
    externalUrl: 'https://music.apple.com/us/album/cute-anxiety-ep/6822634780', quality: '明确标注' },
];

interface AppleEntry {
  id?: { attributes?: { 'im:id'?: string } };
  'im:name'?: { label?: string };
  'im:artist'?: { label?: string };
  'im:releaseDate'?: { label?: string };
  'im:itemCount'?: { label?: string };
  'im:image'?: { label?: string }[];
  category?: { attributes?: { term?: string } };
  link?: { attributes?: { href?: string } };
}
export async function appleNewReleases(region: Region | '', signal: AbortSignal): Promise<Release[]> {
  const [from, to] = dateRange(30);
  const markets = Object.entries(appleMarkets).filter(([, value]) => !region || value === region);
  const results = await Promise.allSettled(markets.map(async ([market, value]) => {
    const response = await fetch(`https://itunes.apple.com/${market}/rss/topalbums/limit=50/json`, { signal: withTimeout(signal) });
    if (!response.ok) throw new Error('Apple chart unavailable');
    const entries: AppleEntry[] = (await response.json()).feed?.entry ?? [];
    return entries.flatMap((entry, index): Release[] => {
      const id = entry.id?.attributes?.['im:id'];
      const title = entry['im:name']?.label;
      const date = entry['im:releaseDate']?.label?.slice(0, 10);
      const genre = entry.category?.attributes?.term || '未分类';
      if (!id || !title || !date || date < from || date > to) return [];
      // Storefronts are signals for discovery, not proof of artist nationality.
      const tagged = inferredRegion(genre);
      return [{
        id, title, date, genre, region: tagged ?? (market === 'kr' || market === 'jp' || market === 'us' ? undefined : value),
        artist: entry['im:artist']?.label ?? '', image: entry['im:image']?.slice(-1)[0]?.label ?? '',
        format: inferFormat(title, Number(entry['im:itemCount']?.label)), kind: 'albums', provider: 'apple',
        externalUrl: entry.link?.attributes?.href, chartRank: index + 1,
      }];
    });
  }));
  if (markets.length && results.every(result => result.status === 'rejected')) throw new Error('Apple unavailable');
  return results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
}

interface ReleaseGroup {
  id: string;
  title: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'artist-credit'?: { name: string; joinphrase?: string }[];
  releases?: { status?: string }[];
  tags?: { name: string; count: number }[];
}

export async function musicBrainzNewReleases(page: number, format: 'EP' | '专辑', weeksAgo: number, signal: AbortSignal): Promise<Release[]> {
  const { start: from, through: to } = releaseWeek(weeksAgo);
  const params = new URLSearchParams({
    query: `firstreleasedate:[${from} TO ${to}] AND primarytype:${format === 'EP' ? 'ep' : 'album'}`,
    fmt: 'json', limit: '50', offset: String((page - 1) * 50),
  });
  const response = await fetch('https://musicbrainz.org/ws/2/release-group/?' + params, { signal: withTimeout(signal) });
  if (!response.ok) throw new Error('MusicBrainz unavailable');
  const groups: ReleaseGroup[] = (await response.json())['release-groups'];
  return groups.flatMap((item): Release[] => {
    const rawDate = item['first-release-date'] ?? '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
    if (date && (date < from || date > to)) return [];
    if (item.releases?.length && item.releases.every(release => release.status && release.status !== 'Official')) return [];
    if (item['primary-type']?.toLowerCase() !== (format === 'EP' ? 'ep' : 'album')) return [];
    const attributes = item['secondary-types'] ?? [];
    const fromTitle = titleFormat(item.title);
    const actual = attributes.includes('Soundtrack') ? '原声带' : attributes.includes('Compilation') ? '精选'
      : attributes.includes('Live') ? '现场' : attributes.includes('Remix') || attributes.includes('Mixtape/Street') ? '其他发行'
      : fromTitle === '未分类' ? format : fromTitle;
    const tags = item.tags ?? [];
    const genre = [...tags].sort((a,b) => b.count - a.count)[0]?.name ?? '未分类';
    return [{
      id: item.id, title: item.title, date, dateHint: rawDate && !date ? rawDate : undefined,
      genre, region: tags.map(tag => inferredRegion(tag.name)).find(Boolean), format: actual, kind: 'albums',
      ai: tags.some(tag => /^(ai.generated|ai music|ai-generated music|artificial intelligence generated)$/i.test(tag.name)),
      artist: item['artist-credit']?.map(artist => artist.name + (artist.joinphrase ?? '')).join('') ?? '',
      image: `https://coverartarchive.org/release-group/${item.id}/front-250`, provider: 'musicbrainz',
      externalUrl: `https://musicbrainz.org/release-group/${item.id}`, quality: '明确标注',
    }];
  });
}

export async function pitchforkReviews(signal: AbortSignal) {
  const response = await fetch('https://pitchfork.com/feed/feed-album-reviews/rss', { signal: withTimeout(signal) });
  if (!response.ok) throw new Error('Pitchfork unavailable');
  const xml = new DOMParser().parseFromString(await response.text(), 'text/xml');
  return [...xml.querySelectorAll('item')].flatMap(item => {
    const title = item.querySelector('title')?.textContent?.trim();
    const url = item.querySelector('link')?.textContent?.trim();
    if (!title || !url?.startsWith('https://pitchfork.com/reviews/albums/')) return [];
    const image = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0]?.getAttribute('url');
    return [{ title, url, image: image?.startsWith('https://media.pitchfork.com/') ? image : undefined }];
  });
}

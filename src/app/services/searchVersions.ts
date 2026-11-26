import { qqMusicService } from './qqMusicService';

const unwrap = (result: any) => { const body = result.body || result; const response = body.response || body; return response.data || response; };
const titleOf = (item: any) => item.songname || item.albumname || item.albumName || item.name || '';
const albumOf = (item: any) => item.albumname || item.album?.name || '';
const artistOf = (item: any) => (item.singer || item.artists || []).map((artist: any) => artist.name).join(' ') || item.singername || item.singerName || '';
const baseTitle = (title: string) => title.replace(/\s*[([](?:explicit|clean)(?: version)?[)\]]/gi, '').trim().toLowerCase();
export const isExplicitVersion = (item: any) => item.explicit === true || /\bexplicit\b/i.test(`${titleOf(item)} ${albumOf(item)}`);

// Keep release identities: two recordings with the same title are still different results.
export function mergeSearchVersions(primary: any[], extra: any[], kind: 'songs' | 'albums') {
  const seen = new Set<string>();
  const groups = new Map<string, any[]>();
  for (const item of [...primary, ...extra]) {
    const id = String(item.songmid || item.albummid || item.albumMID || item.mid || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const key = `${baseTitle(titleOf(item))}:${artistOf(item).toLowerCase()}`;
    const group = groups.get(key) || [];
    group.push(item); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => group.sort((a, b) => Number(isExplicitVersion(b)) - Number(isExplicitVersion(a))));
}

interface VersionResults {
  items: any[]; nextPage: number; consumed: number; total: number; done: boolean;
  expires: number; pending?: Promise<void>;
}
const versionResults = new Map<string, VersionResults>();

export async function searchQQVersions(query: string, kind: 'songs' | 'albums', limit: number, page: number) {
  const group = kind === 'songs' ? 'song' : 'album';
  const key = JSON.stringify([query, kind, limit]);
  let state = versionResults.get(key);
  if (!state || state.expires < Date.now()) {
    state = { items: [], nextPage: 1, consumed: 0, total: 0, done: false, expires: Date.now() + 300000 };
    if (versionResults.size >= 30) versionResults.delete(versionResults.keys().next().value!);
    versionResults.set(key, state);
  }
  const results = state;
  // Serialize loading so rapid page changes cannot consume the same upstream page twice.
  const load = async () => {
    while (!results.done && results.items.length < page * limit) {
      const sourcePage = results.nextPage;
      const data = unwrap(await qqMusicService.searchWithType(query, limit, kind, sourcePage));
      const primary = data[group]?.list || [];
      let extra: any[] = [];
      if (sourcePage === 1 && primary.length) {
        const queries = new Set([`${query} Explicit`, `${query} Clean`]);
        if (kind === 'albums') for (const item of primary.slice(0, 3)) {
          queries.add(`${baseTitle(titleOf(item))} ${artistOf(item)} Explicit`);
        }
        const responses = await Promise.allSettled([...queries].map(value => qqMusicService.searchWithType(value, limit, kind, 1)));
        const keys = new Set(primary.map((item: any) => `${baseTitle(titleOf(item))}:${artistOf(item).toLowerCase()}`));
        extra = responses.flatMap(response => response.status === 'fulfilled' ? unwrap(response.value)[group]?.list || [] : [])
          .filter((item: any) => keys.has(`${baseTitle(titleOf(item))}:${artistOf(item).toLowerCase()}`));
      }
      const seen = new Set(results.items.map(item => String(item.songmid || item.albummid || item.albumMID || item.mid)));
      results.items.push(...mergeSearchVersions(primary, extra, kind).filter(item => !seen.has(String(item.songmid || item.albummid || item.albumMID || item.mid))));
      results.consumed += primary.length;
      results.total = Number(data[group]?.totalnum ?? results.consumed);
      results.nextPage++;
      results.done = !primary.length || results.consumed >= results.total;
    }
  };
  const pending = (results.pending || Promise.resolve()).catch(() => {}).then(load);
  results.pending = pending;
  await pending;
  // Supplementary versions overflow onto subsequent pages instead of enlarging page one.
  return { response: { data: { [group]: {
    list: results.items.slice((page - 1) * limit, page * limit),
    totalnum: results.items.length + (results.done ? 0 : Math.max(0, results.total - results.consumed)),
  } } } };
}

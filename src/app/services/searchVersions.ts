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

export async function searchQQVersions(query: string, kind: 'songs' | 'albums', limit: number, page: number) {
  const group = kind === 'songs' ? 'song' : 'album';
  const result = await qqMusicService.searchWithType(query, limit, kind, page);
  const data = unwrap(result);
  const primary = data[group]?.list || [];
  // Query edition names separately because the upstream relevance search can hide them.
  // Only enrich the first page; subsequent pages retain the upstream paging contract.
  if (page !== 1 || !primary.length) return { response: { data: { ...data, [group]: { ...data[group], list: mergeSearchVersions(primary, [], kind) } } } };
  const queries = new Set([`${query} Explicit`, `${query} Clean`]);
  if (kind === 'albums') for (const item of primary.slice(0, 3)) {
    queries.add(`${baseTitle(titleOf(item))} ${artistOf(item)} Explicit`);
  }
  const responses = await Promise.allSettled([...queries].map(value => qqMusicService.searchWithType(value, limit, kind, 1)));
  const keys = new Set(primary.map((item: any) => `${baseTitle(titleOf(item))}:${artistOf(item).toLowerCase()}`));
  const extra = responses.flatMap(response => response.status === 'fulfilled' ? unwrap(response.value)[group]?.list || [] : [])
    .filter((item: any) => keys.has(`${baseTitle(titleOf(item))}:${artistOf(item).toLowerCase()}`));
  return { response: { data: { ...data, [group]: { ...data[group], list: mergeSearchVersions(primary, extra, kind) } } } };
}

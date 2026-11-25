const cacheName = 'melorank-grammy-artwork-v1';
const thumbnailLimit = 320;
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const quoted = (value: string) => '"' + value.replace(/["\\]/g, '\\$&') + '"';
let nextSearch = 0;

type CoverCandidate = { id: string; title: string; 'artist-credit'?: { name: string; joinphrase?: string }[] };

async function searchSlot(signal: AbortSignal) {
  const now = Date.now();
  const start = Math.max(nextSearch, now);
  nextSearch = start + 1100;
  if (start > now) await new Promise(resolve => setTimeout(resolve, start - now));
  signal.throwIfAborted();
}

async function toThumbnail(image: Blob) {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(1, thumbnailLimit / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .8));
  } finally { bitmap.close(); }
}

export async function resolveGrammyCover(title: string, artist: string, signal: AbortSignal, online = true): Promise<Blob | null> {
  const key = normalize(title) + ':' + normalize(artist);
  if (!normalize(title) || !normalize(artist)) return null;
  const cacheKey = new URL('/grammy/artwork-cache/' + encodeURIComponent(key), location.origin).href;
  const cache = await globalThis.caches?.open(cacheName).catch(() => undefined);
  const cached = await cache?.match(cacheKey).catch(() => undefined);
  if (cached) {
    const age = Date.now() - Number(cached.headers.get('X-MeloRank-Cached'));
    if (cached.status === 200) return cached.blob();
    if (age < 24 * 60 * 60 * 1000) return null;
  }

  if (!online) return null;
  const miss = async () => {
    if (!signal.aborted) await cache?.put(cacheKey, new Response('', {
      status: 404, headers: { 'X-MeloRank-Cached': String(Date.now()) },
    })).catch(() => {});
    return null;
  };
  await searchSlot(signal);
  const deadline = AbortSignal.any([signal, AbortSignal.timeout(1000)]);
  const params = new URLSearchParams({
    query: `releasegroup:${quoted(title)} AND artist:${quoted(artist)}`, fmt: 'json', limit: '8',
  });
  const search = await fetch('https://musicbrainz.org/ws/2/release-group/?' + params, {
    signal: deadline,
  });
  if (!search.ok) return null;
  const candidates: CoverCandidate[] = (await search.json())['release-groups'] ?? [];
  const matches = candidates.filter(candidate => normalize(candidate.title) === normalize(title) &&
    normalize(candidate['artist-credit']?.map(credit => credit.name + (credit.joinphrase ?? '')).join('') ?? '') === normalize(artist));
  // Different release groups can share the same title and credits.
  if (matches.length !== 1 || !/^[\da-f-]{36}$/i.test(matches[0].id)) return miss();
  const image = await fetch(`https://coverartarchive.org/release-group/${matches[0].id}/front-250`, {
    signal: deadline,
  });
  if (image.status === 404) return miss();
  if (!image.ok || !image.headers.get('Content-Type')?.startsWith('image/')) return null;
  const input = await image.blob();
  if (input.size > 2 * 1024 * 1024) return null;
  deadline.throwIfAborted();
  const thumbnail = await toThumbnail(input);
  if (thumbnail && !signal.aborted) await cache?.put(cacheKey, new Response(thumbnail)).catch(() => {});
  return thumbnail;
}

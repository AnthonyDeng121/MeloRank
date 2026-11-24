export interface MusicBrainzRelease {
  id: string;
  title: string;
  artist: string;
  date?: string;
  dateHint?: string;
  format: '专辑' | 'EP' | '原声带' | '精选' | '现场';
  genre: string;
  image: string;
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

export async function musicBrainzNewReleases(page: number, limit: number, signal: AbortSignal) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  const from = start.toLocaleDateString('sv-SE');
  const to = now.toLocaleDateString('sv-SE');
  const params = new URLSearchParams({
    query: `firstreleasedate:[${from} TO ${to}] AND (primarytype:album OR primarytype:ep)`,
    fmt: 'json', limit: String(limit), offset: String((page - 1) * limit),
  });
  const response = await fetch('https://musicbrainz.org/ws/2/release-group/?' + params, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
  });
  if (!response.ok) throw new Error('MusicBrainz unavailable');
  const groups: ReleaseGroup[] = (await response.json())['release-groups'];
  return {
    hasMore: groups.length === limit,
    items: groups.flatMap((item): MusicBrainzRelease[] => {
      const date = item['first-release-date'] ?? '';
      const hasExactDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
      if (hasExactDate && (date < from || date > to)) return [];
      if (item.releases?.length && !item.releases.some(release => release.status === 'Official')) return [];
      const attributes = item['secondary-types'] ?? [];
      const format = attributes.includes('Soundtrack') ? '原声带' : attributes.includes('Compilation') ? '精选'
        : attributes.includes('Live') ? '现场' : item['primary-type'] === 'EP' ? 'EP' : '专辑';
      const genre = item.tags?.reduce<(typeof item.tags)[number] | undefined>((best, tag) =>
        !best || tag.count > best.count ? tag : best, undefined)?.name ?? '未分类';
      return [{
        id: item.id, title: item.title, date: hasExactDate ? date : undefined,
        dateHint: date && !hasExactDate ? date + '（日期待确认）' : undefined, format, genre,
        artist: item['artist-credit']?.map(artist => artist.name + (artist.joinphrase ?? '')).join('') ?? '',
        image: `https://coverartarchive.org/release-group/${item.id}/front-250`,
      }];
    }),
  };
}

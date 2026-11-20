export const normalizeMVTitle = (value: string) => value.replace(/official\s*(music\s*)?video|music\s*video|\bMV\b|\bM\/V\b/gi, '').normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Only auto-open a unique title+artist match; alternate versions stay selectable.
export function uniqueMVMatch<T>(items: T[], title: string, artist: string, read: (item: T) => { title: string; artist: string }): T | undefined {
  const key = normalizeMVTitle(title), artistKey = normalizeMVTitle(artist);
  if (!key || !artistKey) return;
  const matches = items.filter(item => {
    const value = read(item), name = normalizeMVTitle(value.artist);
    return normalizeMVTitle(value.title) === key && !!name && (name.includes(artistKey) || artistKey.includes(name));
  });
  return matches.length === 1 ? matches[0] : undefined;
}

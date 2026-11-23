type Identity = { title: string; artist: string };
const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const clean = (value: string) => value.replace(/official\s*(music\s*)?video|music\s*video|\bMV\b|\bM\/V\b|官方音乐视频|官方音樂影片|官方版|高清版|\b(?:1080p|720p|4k|hd)\b/gi, '');
const artists = (value: string) => value.split(/\s*(?:[,，/、&]|\bfeat\.?|\bfeaturing\b)\s*/i).flatMap(name => [name.replace(/[\uFF08(].*?[\uFF09)]/g, ''), ...Array.from(name.matchAll(/[\uFF08(]([^\uFF09)]+)[\uFF09)]/g), match => match[1])]).map(normalize).filter(Boolean);
const versions = [ /\blive\b|现场|現場|演唱会|演唱會/i, /\bremix\b|混音/i, /\bacoustic\b|不插电|不插電/i, /\bcover\b|翻唱/i, /\binstrumental\b|伴奏/i ];

export function firstRelatedMV<T>(items: T[], source: Identity, read: (item: T) => Identity): T | undefined {
  const title = normalize(clean(source.title).split(/\s*[\uFF08(]/)[0]);
  const names = artists(source.artist);
  if (!title || !names.length) return;
  return items.find(item => {
    const candidate = read(item);
    if (!artists(candidate.artist).some(name => names.includes(name))) return false;
    if (versions.some(pattern => pattern.test(source.title) !== pattern.test(candidate.title))) return false;
    if (/lyrics?\s*video|official\s*audio|visuali[sz]er|歌词版|歌詞版|纯音频|純音頻/i.test(candidate.title)) return false;
    const candidateTitle = normalize(clean(candidate.title).split(/\s*[\uFF08(]/)[0]);
    return candidateTitle === title || names.some(name => candidateTitle === name + title || candidateTitle === title + name);
  });
}

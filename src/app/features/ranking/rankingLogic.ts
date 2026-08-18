/** 排行榜纯业务逻辑。该模块不依赖 React 或浏览器 API，便于复用和测试。 */

export interface RankingItem {
  id: string;
  rank: number;
  title: string;
  artist: string;
  coverUrl: string;
  review: string;
  originalScore: number;
  integrity: number;
  durability: number;
  finalScore: number;
  totalScore?: number;
}

export type ScoringMode = 'scoring' | 'non-scoring';

/** 判断当前列表是否仍是内置示例榜单。 */
export function isDefaultRanking(items: RankingItem[]): boolean {
  return items.length === 3 && items.every(item => ['1', '2', '3'].includes(item.id));
}

/** 标题排序：英文在前，随后按本地化规则排序，同名时短标题优先。 */
export function sortRankingTitles(a: string, b: string): number {
  const strA = a.toLowerCase();
  const strB = b.toLowerCase();
  const englishPattern = /^[a-z0-9\s\-_.,!?'''"()[\]{}:;]+$/;
  const isEnglishA = englishPattern.test(strA);
  const isEnglishB = englishPattern.test(strB);

  if (isEnglishA !== isEnglishB) return isEnglishA ? -1 : 1;

  const localeResult = strA.localeCompare(strB, isEnglishA ? 'en-US' : 'zh-CN-u-co-pinyin', {
    numeric: true,
    sensitivity: 'base',
    caseFirst: 'upper'
  });
  return localeResult === 0 ? a.length - b.length : localeResult;
}

/** 非评分模式按标题排序，并重新生成连续名次。 */
export function rankWithoutScoring(items: RankingItem[]): RankingItem[] {
  return [...items]
    .sort((a, b) => sortRankingTitles(a.title, b.title))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** 将原始分、完整度和耐听度映射到 0-10 分。 */
export function calculateLinearScores<T extends RankingItem>(items: T[]): T[] {
  if (items.length === 0) return [];

  const scored = items.map(item => ({
    item,
    totalScore: Number((item.originalScore + item.integrity + item.durability).toFixed(2))
  }));
  const sorted = [...scored].sort((a, b) => b.totalScore - a.totalScore);
  const scores = sorted.map(entry => entry.totalScore);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const sameScore = maxScore === minScore;

  return sorted.map(({ item, totalScore }, index) => ({
    ...item,
    rank: index + 1,
    totalScore,
    finalScore: sameScore
      ? 10
      : Number((((totalScore - minScore) / (maxScore - minScore)) * 10).toFixed(1))
  }));
}

/** 按评分模式统一整理榜单。 */
export function normalizeRanking<T extends RankingItem>(items: T[], mode: ScoringMode): T[] {
  return mode === 'scoring' ? calculateLinearScores(items) : rankWithoutScoring(items) as T[];
}

/** 解析“名次. 歌名 - 歌手”格式的纯文本榜单。 */
export function parseRankingText(text: string): Array<Pick<RankingItem, 'rank' | 'title' | 'artist'>> {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(?:\d+[.、)）]\s*)?(.+?)(?:\s+-\s+|\s+—\s+|\s+–\s+)(.+)$/);
      if (match) return { rank: index + 1, title: match[1].trim(), artist: match[2].trim() };
      return { rank: index + 1, title: line.replace(/^\d+[.、)）]\s*/, '').trim(), artist: '' };
    });
}

import type { RankingItem } from './rankingLogic';

/** 删除条目并重新生成连续名次。 */
export function removeRankingItem(items: RankingItem[], id: string): RankingItem[] {
  return items.filter(item => item.id !== id).map((item, index) => ({ ...item, rank: index + 1 }));
}

/** 将指定条目向上移动一位。 */
export function moveRankingItemUp(items: RankingItem[], id: string): RankingItem[] {
  const index = items.findIndex(item => item.id === id);
  if (index <= 0) return items;
  const result = [...items];
  [result[index - 1], result[index]] = [result[index], result[index - 1]];
  return result.map((item, rank) => ({ ...item, rank: rank + 1 }));
}

/** 将指定条目向下移动一位。 */
export function moveRankingItemDown(items: RankingItem[], id: string): RankingItem[] {
  const index = items.findIndex(item => item.id === id);
  if (index < 0 || index >= items.length - 1) return items;
  const result = [...items];
  [result[index], result[index + 1]] = [result[index + 1], result[index]];
  return result.map((item, rank) => ({ ...item, rank: rank + 1 }));
}

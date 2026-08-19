import React, { forwardRef } from 'react';
import type { RankingItem, ScoringMode } from './rankingLogic';

interface Props { items: RankingItem[]; mode: ScoringMode; formatScore: (score: number) => string; }

/** PDF 和图片导出使用的隐藏榜单预览。 */
export const RankingExportPreview = forwardRef<HTMLDivElement, Props>(({ items, mode, formatScore }, ref) => (
  <div ref={ref} style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', background: '#fff' }}>
    <table className="rank-export-table"><thead><tr><th>封面</th><th>详情</th>{mode === 'scoring' && <th>评分</th>}</tr></thead><tbody>
      {items.map((item, index) => <React.Fragment key={item.id}><tr><td colSpan={3} className="rank-export-title-row"><strong>NO.{mode === 'scoring' ? item.rank : index + 1}</strong> {item.title} - {item.artist}</td></tr><tr className="rank-export-content-row"><td className="rank-export-cover"><img src={item.coverUrl} alt={item.title} /></td><td className="rank-export-details"><p>{item.review || '暂无评价'}</p>{mode === 'scoring' && <p>原始分数：{item.originalScore}，整体性：{item.integrity}，保值度：{item.durability}</p>}</td>{mode === 'scoring' && <td className="rank-export-final-score">{formatScore(item.finalScore)}</td>}</tr></React.Fragment>)}
    </tbody></table>
  </div>
));
RankingExportPreview.displayName = 'RankingExportPreview';

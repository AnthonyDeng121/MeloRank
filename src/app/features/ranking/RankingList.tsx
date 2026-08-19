import React from 'react';
import type { RankingItem, ScoringMode } from './rankingLogic';

interface Props {
  items: RankingItem[];
  mode: ScoringMode;
  onEdit: (item: RankingItem) => void;
  onDelete: (id: string) => void;
  onMoveUp: (item: RankingItem) => void;
  onMoveDown: (item: RankingItem) => void;
}

/** 榜单条目展示与操作。 */
export function RankingList({ items, mode, onEdit, onDelete, onMoveUp, onMoveDown }: Props) {
  return <div className="user-ranking-list">
    {items.map((item, index) => <div key={item.id} className="user-rank-item">
      <div className="user-rank-number">{mode === 'non-scoring' ? index + 1 : item.rank}</div>
      <div className="user-rank-cover"><img src={item.coverUrl} alt={item.title} /></div>
      <div className="user-rank-content">
        <div className="user-rank-title">{item.title}</div>
        <div className="user-rank-artist">{item.artist}</div>
        <div className="user-rank-review">{item.review || '暂无评价'}</div>
      </div>
      {mode === 'scoring' && <div className="user-rank-score"><div className="score-box">{item.originalScore}</div></div>}
      <div className="user-rank-actions">
        {mode === 'non-scoring' && <>
          <button className="action-btn move-btn" onClick={() => onMoveUp(item)} disabled={index === 0}>上移</button>
          <button className="action-btn move-btn" onClick={() => onMoveDown(item)} disabled={index === items.length - 1}>下移</button>
        </>}
        <button className="action-btn edit-btn" onClick={() => onEdit(item)}>编辑</button>
        <button className="action-btn delete-btn" onClick={() => onDelete(item.id)}>删除</button>
      </div>
    </div>)}
  </div>;
}

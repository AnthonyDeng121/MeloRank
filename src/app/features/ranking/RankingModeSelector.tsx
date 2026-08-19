import React from 'react';
import type { ScoringMode } from './rankingLogic';

interface Props {
  rankingMode: string;
  rankingModes: string[];
  scoringMode: ScoringMode;
  scoringModes: Array<{ value: ScoringMode; label: string }>;
  onRankingModeChange: (mode: string) => void;
  onScoringModeChange: (mode: ScoringMode) => void;
  onImport: () => void;
}

/** 排行榜类型、评分模式和导入入口。 */
export function RankingModeSelector(props: Props) {
  return (
    <div className="ranking-mode-selector" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <label htmlFor="ranking-mode">选择榜单类型：</label>
        <select id="ranking-mode" value={props.rankingMode} onChange={event => props.onRankingModeChange(event.target.value)}>
          {props.rankingModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
        </select>
        <label htmlFor="scoring-mode" style={{ marginLeft: '15px' }}>选择是否评分：</label>
        <select id="scoring-mode" value={props.scoringMode} onChange={event => props.onScoringModeChange(event.target.value as ScoringMode)}>
          {props.scoringModes.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
        </select>
      </div>
      <button className="export-btn" onClick={props.onImport}>导入排行榜</button>
    </div>
  );
}

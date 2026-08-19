import React from 'react';
import type { RankingItem, ScoringMode } from './rankingLogic';

interface Props {
  rankingMode: string;
  scoringMode: ScoringMode;
  editMode: boolean;
  coverUrl: string;
  coverPreview: string;
  searchQuery: string;
  searchResults: any[];
  isSearching: boolean;
  searchError: string | null;
  integrityRef: React.RefObject<HTMLInputElement | null>;
  durabilityRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onSearchResultClick: (result: any) => void;
  onCoverPreview: (url: string) => void;
  onCoverChange: (value: string) => void;
  onCoverPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectFile: () => void;
  onAdjustScore: (ref: React.RefObject<HTMLInputElement | null>, increase: boolean) => void;
}

/** 榜单新增和编辑表单。 */
export function RankingEditor(props: Props) {
  return <div className="ranking-form"><h3>{props.editMode ? '编辑榜单条目' : `添加到 ${props.rankingMode}`}</h3><form onSubmit={props.onSubmit}>
    <div className="form-group search-container"><label>搜索</label><input className="search-input" value={props.searchQuery} placeholder="搜索歌曲、专辑或艺人" onChange={event => props.onSearchChange(event.target.value)} onFocus={props.onSearchFocus} autoComplete="off" />{props.isSearching && <span className="search-loading">搜索中...</span>}{props.searchError && <div className="search-error">{props.searchError}</div>}{props.searchResults.length > 0 && <div className="search-results-dropdown">{props.searchResults.map(result => <div key={result.id} className="search-result-item" onClick={() => props.onSearchResultClick(result)}><img src={result.coverUrl} alt={result.title} /><span>{result.title} - {result.artist}</span><button type="button" onClick={event => { event.stopPropagation(); props.onCoverPreview(result.coverUrl); }}>查看封面</button></div>)}</div>}</div>
    <div className="form-group"><label>封面图片</label><input type="text" name="coverUrl" value={props.coverUrl} placeholder="输入图片 URL" onChange={event => props.onCoverChange(event.target.value)} onPaste={props.onCoverPaste} /><input type="file" accept="image/*" ref={props.fileInputRef} onChange={props.onFileUpload} style={{ display: 'none' }} /><button type="button" className="upload-btn" onClick={props.onSelectFile}>上传本地图片</button>{props.coverPreview && <div className="cover-preview"><img src={props.coverPreview} alt="封面预览" /></div>}</div>
    <div className="form-group"><label>作品名称</label><input name="title" placeholder="输入歌曲或专辑名称" autoComplete="off" /></div>
    <div className="form-group"><label>艺术家</label><input name="artist" placeholder="输入艺术家名称" autoComplete="off" /></div>
    <div className="form-group"><label>评分</label><input type="number" name="score" min="0" max="100" step="0.01" disabled={props.scoringMode === 'non-scoring'} /></div>
    {(['整体性', '保值度'] as const).map((label, index) => { const scoreRef = index === 0 ? props.integrityRef : props.durabilityRef; return <div className="form-group" key={label}><label>{label}</label><input type="number" ref={scoreRef} defaultValue="0" readOnly disabled={props.scoringMode === 'non-scoring'} /><button type="button" onClick={() => props.onAdjustScore(scoreRef, true)} disabled={props.scoringMode === 'non-scoring'}>增加</button><button type="button" onClick={() => props.onAdjustScore(scoreRef, false)} disabled={props.scoringMode === 'non-scoring'}>减少</button></div>; })}
    <div className="form-group"><label>评价</label><textarea name="review" rows={4} placeholder="写下你的评价..." /></div><button type="submit" className="add-btn">{props.editMode ? '修改完成' : '添加到榜单'}</button>
  </form></div>;
}

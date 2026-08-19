import React from 'react';

interface Props {
  showRestore: boolean;
  showHistory: boolean;
  showImport: boolean;
  history: any[];
  importText: string;
  onRestore: () => void;
  onCancelRestore: () => void;
  onCloseHistory: () => void;
  onLoadHistory: (item: any) => void;
  onDeleteHistory: (id: string | number) => void;
  onImportTextChange: (value: string) => void;
  onImport: () => void;
  onCloseImport: () => void;
}

/** 排行榜确认、历史和导入弹窗。 */
export function RankingDialogs(props: Props) {
  return <>
    {props.showRestore && <div className="confirm-dialog-overlay"><div className="confirm-dialog"><div className="confirm-dialog-header"><h4>恢复默认榜单</h4></div><div className="confirm-dialog-content"><p>确定恢复默认榜单吗？当前内容将被替换。</p></div><div className="confirm-dialog-footer"><button className="confirm-dialog-confirm" onClick={props.onRestore}>确认</button><button className="confirm-dialog-cancel" onClick={props.onCancelRestore}>取消</button></div></div></div>}
    {props.showHistory && <div className="confirm-dialog-overlay"><div className="confirm-dialog" style={{ width: '800px', maxHeight: '600px', overflowY: 'auto' }}><div className="confirm-dialog-header"><h4>历史榜单记录</h4><button className="confirm-dialog-close" onClick={props.onCloseHistory}>×</button></div><div className="confirm-dialog-content">{props.history.length === 0 ? <p>暂无历史榜单记录</p> : props.history.map((item, index) => <div key={item.id || index} className="history-ranking-item"><div><h5>{item.year} {item.type}</h5><p>包含 {item.rankingList?.length || 0} 个项目</p></div><div><button className="confirm-dialog-confirm" onClick={() => props.onLoadHistory(item)}>加载</button><button className="confirm-dialog-cancel" onClick={() => props.onDeleteHistory(item.id || index)}>删除</button></div></div>)}</div><div className="confirm-dialog-footer"><button className="confirm-dialog-cancel" onClick={props.onCloseHistory}>关闭</button></div></div></div>}
    {props.showImport && <div className="confirm-dialog-overlay"><div className="confirm-dialog" style={{ width: '800px' }}><div className="confirm-dialog-header"><h4>导入排行榜</h4><button className="confirm-dialog-close" onClick={props.onCloseImport}>×</button></div><div className="confirm-dialog-content"><p>请输入“作品名 - 艺人”的榜单文本。</p><textarea style={{ width: '100%', height: '220px' }} value={props.importText} onChange={event => props.onImportTextChange(event.target.value)} /></div><div className="confirm-dialog-footer"><button className="confirm-dialog-confirm" onClick={props.onImport}>确认导入</button><button className="confirm-dialog-cancel" onClick={props.onCloseImport}>取消</button></div></div></div>}
  </>;
}

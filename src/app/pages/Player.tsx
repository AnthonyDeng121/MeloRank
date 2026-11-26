import { usePlatformAccounts } from '../contexts/PlatformAccountsContext';
import { uniqueMVMatch } from '../services/mvMatching';
import { MVPlayer, searchMVs, type MVItem } from '../components/MVBrowser';
import { SongRating } from '../components/SongRating';
import { PitchComparison as PitchPanel } from '../components/PitchPanel';
import { CatalogPanel } from '../components/CatalogPanel';
import { WorkReview } from '../components/WorkReview';
import { songEntity, type CatalogItem } from '../services/catalog';
import { songCover, platformPlayableUrl } from '../services/platformSongs';
import { toast } from 'sonner';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/Player.css';
import '../../styles/LyricSeeking.css';
import { Repeat1, ListMusic, Shuffle, Maximize2, X } from 'lucide-react';
import { parseLrc, matchLyric } from '../services/lyrics';

export function Player({ selection, onSelectionChange, mvSelection, onMVChange }: { onMVChange?: (item: MVItem | null) => void; mvSelection?: MVItem | null; selection: CatalogItem | null; onSelectionChange: (value: CatalogItem | null) => void }) {
  const { activeProvider } = usePlatformAccounts();
  const [mvMatches, setMVMatches] = useState<MVItem[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const linkVersion = useRef(0);
  const [view, setView] = useState<'songs' | 'albums' | 'artists' | 'mvs'>(selection?.kind || 'songs');
  useEffect(() => { if (selection) setView(selection.kind); }, [selection]);
  useEffect(() => { if (mvSelection) setView('mvs'); }, [mvSelection]);
  const [downloading, setDownloading] = useState(false);
  const setDownloadError = (message: string) => { if (message) toast.error(message, { duration: 3000 }); };
  const [showTranslation, setShowTranslation] = useState(() => localStorage.getItem('lyricsTranslation') === 'true');
  const [showRomanization, setShowRomanization] = useState(() => localStorage.getItem('lyricsRomanization') === 'true');
  const downloadSong = async () => {
    if (!currentSong || downloading) return;
    const song = currentSong;
    setDownloading(true); setDownloadError('');
    try {
      const url = song.url || await platformPlayableUrl(song);
      const response = await fetch(url);
      if (!response.ok) throw new Error('下载失败，请稍后重试');
      const blob = await response.blob();
      if (!blob.size || /text|json/.test(blob.type)) throw new Error('音源无效或暂无下载权限');
      const ext = /\.(mp3|m4a|flac|ape|wav)(?:[?]|$)/i.exec(url)?.[1] || (blob.type.includes('mp4') ? 'm4a' : 'mp3');
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${song.songname} - ${song.singer.map(s => s.name).join(', ')}.${ext}`.replace(/[<>:"/\\|?*]/g, '_');
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : '下载失败');
    } finally { setDownloading(false); }
  };
  // 使用音乐播放上下文
  const { currentSong, isPlaying, togglePlay, volume, setVolume, lyrics, lyricSource, translation, romanization, currentTime, duration, seekTo, previousSong, nextSong, playMode, setPlayMode } = useMusic();
  const translatedLines = useMemo(() => parseLrc(translation), [translation]);
  const romanizedLines = useMemo(() => parseLrc(romanization), [romanization]);
  
  const previousSongId = useRef(currentSong?.songmid);
  useEffect(() => {
    const songChanged = previousSongId.current !== currentSong?.songmid;
    previousSongId.current = currentSong?.songmid;
    linkVersion.current++; setMVMatches([]); setLinkBusy(false);
    if (mvSelection && (songChanged || mvSelection.provider !== activeProvider)) { setView('songs'); onMVChange?.(null); }
  }, [activeProvider, currentSong?.songmid]);
  const findMV = async () => {
    if (!currentSong || linkBusy) return;
    const version = ++linkVersion.current;
    setLinkBusy(true); setMVMatches([]);
    try {
      const result = await searchMVs(currentSong.provider || 'qq', `${currentSong.songname.split(/\s*[?(]/)[0]} ${currentSong.singer[0]?.name || ''}`, 1);
      if (version !== linkVersion.current) return;
      const exact = uniqueMVMatch<MVItem>(result.items, currentSong.songname, currentSong.singer[0]?.name || '', item => item);
      if (exact) { onMVChange?.(exact); setView('mvs'); }
      else setMVMatches(result.items);
      if (!result.items.length) toast.info('未找到对应 MV');
    } catch (error) { if (version === linkVersion.current) toast.error(error instanceof Error ? error.message : 'MV 查找失败'); }
    finally { if (version === linkVersion.current) setLinkBusy(false); }
  };
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // 播放模式切换
  const togglePlayMode = () => {
    const modes: Array<'single' | 'sequence' | 'random'> = ['single', 'sequence', 'random'];
    const currentModeIndex = modes.indexOf(playMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setPlayMode(nextMode);
  };

  // 获取播放模式文本
  const getPlayModeText = () => {
    switch (playMode) {
      case 'single':
        return '单曲循环';
      case 'sequence':
        return '顺序播放';
      case 'random':
        return '随机播放';
      default:
        return '单曲循环';
    }
  };

  // 获取播放模式图标
  const getPlayModeIcon = () => {
    switch (playMode) {
      case 'single':
        return '🔂';
      case 'sequence':
        return '▶️';
      case 'random':
        return '🔀';
      default:
        return '🔂';
    }
  };
  
  // 获取歌词

  
  // 格式化时间函数：将秒转换为分:秒格式
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 处理进度条拖动事件
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    const newTime = (newValue / 100) * duration;
    seekTo(newTime);
  };

  // 歌词解析函数
  const parseLyrics = (lyricString: string) => {
    if (!lyricString) return [];
    const timeExp = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?]/g;
    const lines = lyricString.split('\n');
    const parsedLyrics = [];

    for (const line of lines) {
      const matches = [...line.matchAll(timeExp)];
      if (matches.length > 0) {
        const text = line.replace(timeExp, '').trim();
        for (const match of matches) {
          const [, minutes, seconds, milliseconds = '00'] = match;
          const time = parseInt(minutes) * 60 + parseInt(seconds) + Number(`0.${milliseconds}`);
          parsedLyrics.push({ time, text });
        }
      }
    }

    return parsedLyrics.sort((a, b) => a.time - b.time);
  };

  // 解析后的歌词
  const parsedLyrics = useMemo(() => parseLrc(lyrics), [lyrics]);

  // 当前歌词索引
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);
  const fullLyricsDialog = useRef<HTMLDialogElement>(null);
  const fullLyricsViewport = useRef<HTMLDivElement>(null);
  const openFullLyrics = () => {
    fullLyricsDialog.current?.showModal();
    const viewport = fullLyricsViewport.current;
    const line = viewport?.querySelector<HTMLElement>('.current-lyric');
    if (viewport && line) viewport.scrollTop += line.getBoundingClientRect().top - viewport.getBoundingClientRect().top - (viewport.clientHeight - line.clientHeight) / 2;
  };

  // 根据当前播放时间更新歌词索引
  useEffect(() => {
    if (parsedLyrics.length === 0) return;

    let index = 0;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }

    setCurrentLyricIndex(index);
  }, [currentTime, parsedLyrics]);

  // 获取当前要显示的5句歌词
  const getDisplayLyrics = () => {
    const startIndex = Math.max(0, currentLyricIndex - 1);
    const endIndex = Math.min(parsedLyrics.length - 1, currentLyricIndex + 1);
    return parsedLyrics.slice(startIndex, endIndex + 1);
  };

  // 计算当前显示歌词的起始索引
  const displayStartIndex = Math.max(0, currentLyricIndex - 1);
  
  // 模拟数据，当没有当前播放歌曲时使用
  const mockTrack = {
    name: '示例歌曲',
    artists: [{ name: '示例歌手' }],
    album: {
      name: '示例专辑',
      coverUrl: 'https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg'
    }
  };
  
  // 确定当前显示的歌曲
  const displayTrack = currentSong ? {
    name: currentSong.songname,
    artists: currentSong.singer,
    album: {
      name: currentSong.albumname,
      coverUrl: songCover(currentSong)
    }
  } : mockTrack;
  const browsingItem = (view === 'songs' || view === 'mvs') ? null : selection?.kind === view ? selection : currentSong ? songEntity(currentSong, view) : null;
  const changeView = (kind: 'songs' | 'albums' | 'artists' | 'mvs') => {
    setView(kind);
    if (kind === 'songs') onSelectionChange(null);
    else if (kind !== 'mvs' && selection?.kind !== kind && currentSong) onSelectionChange(songEntity(currentSong, kind));
  };
  
  return (
    <div className="player-page">
      <nav className="player-view-tabs" aria-label="播放器内容">{([['songs', '歌曲'], ['albums', '专辑'], ['artists', '歌手'], ['mvs', 'MV']] as const).map(([kind, label]) => <button key={kind} aria-pressed={view === kind} disabled={kind === 'mvs' ? !mvSelection && (!currentSong || activeProvider === 'spotify') : kind !== 'songs' && !currentSong && selection?.kind !== kind} data-disabled-reason="请先选择歌曲，或从搜索结果打开专辑、歌手" onClick={() => { if (kind === 'mvs' && !mvSelection) { void findMV(); return; } changeView(kind); }}>{label}</button>)}</nav>
      {mvMatches.length > 0 && <section className="mv-link-results"><h3>选择对应 MV</h3>{mvMatches.map(item => <button key={item.id} onClick={() => { onMVChange?.(item); setMVMatches([]); setView('mvs'); }}>{item.title} · {item.artist}</button>)}<button onClick={() => setMVMatches([])}>收起</button></section>}
      {view === 'mvs' ? (mvSelection?.provider === activeProvider ? <MVPlayer key={`${mvSelection.provider}:${mvSelection.id}`} item={mvSelection} onSong={() => { onMVChange?.(null); setView('songs'); }} /> : <p>请从搜索结果或当前歌曲选择 MV</p>) : view !== 'songs' ? (browsingItem ? <CatalogPanel key={`${browsingItem.provider}:${browsingItem.id}:${view}`} item={browsingItem} /> : <p>请先选择歌曲或搜索作品</p>) : <>
      <div className="player-main">
        <div className="player-left">
          {/* QQ音乐播放器 */}
          <div className="qq-music-player">
            <div className="player-content">
              <div className="player-song-summary">
              <div className="album-cover-large">
                <img 
                  src={displayTrack.album.coverUrl} 
                  alt={displayTrack.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }}
                />
              </div>
              


              </div>
              <div className="player-control-stack">
              <div className="track-info">
                <h3 className="track-title">{currentSong ? displayTrack.name : '暂未选择歌曲'}</h3>
                {currentSong && <p className="track-artist">{displayTrack.artists.map((artist: any) => artist.name).join(', ')}</p>}
              </div>
              <div className="player-controls-row">
                <button className="player-action-button" onClick={() => void findMV()} disabled={!currentSong || linkBusy || activeProvider === 'spotify'} data-disabled-reason={linkBusy ? '正在查找 MV' : '请先选择支持 MV 的歌曲'}>{linkBusy ? '查找中…' : '对应 MV'}</button>
                <div className="player-controls">
                  <button className="control-btn" aria-label="上一首" disabled={!currentSong} data-disabled-reason="请先选择歌曲" onClick={previousSong}>
                    ⏮
                  </button>
                  <button 
                    className={`control-btn ${isPlaying ? 'pause' : 'play'}`}
                    onClick={togglePlay} aria-label={isPlaying ? '暂停' : '播放'} disabled={!currentSong} data-disabled-reason="请先选择歌曲"
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className="control-btn" aria-label="下一首" disabled={!currentSong} data-disabled-reason="请先选择歌曲" onClick={nextSong}>
                    ⏭
                  </button>
                </div>
                
                <button 
                  className="player-action-button"
                  onClick={togglePlayMode}
                  title={getPlayModeText()}
                >
                  {playMode === 'single' ? <Repeat1 size={16} /> : playMode === 'random' ? <Shuffle size={16} /> : <ListMusic size={16} />} {getPlayModeText()}
                </button>
                <button className="player-action-button" onClick={downloadSong} disabled={!currentSong || downloading || currentSong.provider === 'spotify'} data-disabled-reason={!currentSong ? '请先选择歌曲' : currentSong.provider === 'spotify' ? 'Spotify 不提供音频文件下载' : '正在下载当前歌曲，请稍候'} title="下载当前歌曲" aria-label="下载当前歌曲">
                  {downloading ? '下载中…' : '下载'}
                </button>
              </div>


              
              <div className="progress-bar">
                  <div className="progress-slider">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={duration > 0 ? (currentTime / duration) * 100 : 0} 
                      className="slider"
                      style={{ '--slider-progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
                      onChange={handleProgressChange}
                      onInput={handleProgressChange}
                    />
                  </div>
                  <div className="time-display">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              
              <div className="volume-control">
                <span className="volume-icon">🔊</span>
                <div className="volume-slider">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={volume} 
                    className="slider"
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                </div>
                <span className="volume-value">{volume}%</span>
              </div>
              </div>
              <PitchPanel sourceKey={currentSong ? `${currentSong.provider || 'qq'}:${currentSong.songmid}` : ''} currentTime={currentTime} unavailable={!currentSong ? '请先选择歌曲' : currentSong.provider === 'spotify' ? 'Spotify 音源暂不支持音高分析' : undefined} getAudio={async () => {
                if (!currentSong) throw new Error('请先选择歌曲');
                const url = currentSong.url || await platformPlayableUrl(currentSong);
                const response = await fetch(url);
                if (!response.ok) throw new Error('音源读取失败，需允许跨域访问');
                return response.arrayBuffer();
              }} />
            </div>
          </div>
        </div>

        <div className="player-right">
          {/* 互换位置：Lyrics面板放在上面 */}
          <div className="lyrics-panel">
            <div className="lyrics-header">
              <h3>歌词{lyricSource === "LRCLIB" && <a className="lyric-source" href="https://lrclib.net" target="_blank" rel="noreferrer">LRCLIB</a>}</h3>
            <div className="lyrics-display-options">
              <button type="button" aria-pressed={showTranslation} onClick={() => { setShowTranslation(!showTranslation); localStorage.setItem('lyricsTranslation', String(!showTranslation)); }}>翻译</button>
              <button type="button" aria-pressed={showRomanization} onClick={() => { setShowRomanization(!showRomanization); localStorage.setItem('lyricsRomanization', String(!showRomanization)); }}>音译 / 罗马音</button>
              {(showTranslation && !translatedLines.some(line => line.text) || showRomanization && !romanizedLines.some(line => line.text)) && <span>该歌曲暂无{showTranslation && !translatedLines.some(line => line.text) ? '翻译' : ''}{showTranslation && !translatedLines.some(line => line.text) && showRomanization && !romanizedLines.some(line => line.text) ? '及' : ''}{showRomanization && !romanizedLines.some(line => line.text) ? '音译' : ''}</span>}
            </div>
              <div className="lyrics-actions">
                <button type="button" className="lyrics-btn lyrics-expand" aria-label="展开完整歌词" title="展开完整歌词" onClick={openFullLyrics}><Maximize2 size={18} /></button>
                <button className="lyrics-btn" disabled={!lyrics.trim()} data-disabled-reason="当前歌曲暂无歌词" onClick={async () => {
                  // 提取纯歌词文本，不包含时间戳
                  const pureLyrics = parsedLyrics.length ? parsedLyrics.map(lyric => lyric.text).join('\n') : lyrics;
                  await navigator.clipboard.writeText(pureLyrics);
                  setShowCopySuccess(true);
                  setTimeout(() => setShowCopySuccess(false), 1500);
                }}>复制</button>
                <button className="lyrics-btn" disabled={!lyrics.trim()} data-disabled-reason="当前歌曲暂无歌词" onClick={() => {
                  // 提取纯歌词文本，不包含时间戳
                  const pureLyrics = parsedLyrics.length ? parsedLyrics.map(lyric => lyric.text).join('\n') : lyrics;
                  const blob = new Blob([pureLyrics], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = '歌词.txt';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}>导出</button>
              </div>
              {showCopySuccess && (
                <div className="copy-success-toast">
                  复制成功！
                </div>
              )}
            </div>
            <div className="lyrics-content">
              {parsedLyrics.length > 0 ? (
                <div className="dynamic-lyrics">
                  {getDisplayLyrics().map((lyric, index) => {
                    const actualIndex = displayStartIndex + index;
                    const isCurrent = actualIndex === currentLyricIndex;
                    return (
                      <p 
                        key={actualIndex} 
                        className={`lyric-line ${isCurrent ? 'current-lyric' : ''}`}
                      >
                        <span className="lyric-original">{lyric.text}</span>
                        {showTranslation && matchLyric(translatedLines, lyric.time) && <span className="lyric-translation">{matchLyric(translatedLines, lyric.time)}</span>}
                        {showRomanization && matchLyric(romanizedLines, lyric.time) && <span className="lyric-romanization">{matchLyric(romanizedLines, lyric.time)}</span>}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <p className={lyrics.trim() ? "plain-lyrics" : "no-lyrics"}>{lyrics.trim() || "暂无歌词"}</p>
              )}
            </div>
          </div>
          <dialog aria-label="完整歌词" className="full-lyrics-dialog" ref={fullLyricsDialog} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
            <div className="full-lyrics-surface">
              <div className="lyrics-header">
                <div><h3>完整歌词</h3><p className="full-lyrics-title">{currentSong?.songname}</p></div>
                <button type="button" className="lyrics-btn lyrics-expand full-lyrics-close" aria-label="关闭完整歌词" onClick={() => fullLyricsDialog.current?.close()}><X size={20} /></button>
              </div>
            <div className="lyrics-display-options">
              <button type="button" aria-pressed={showTranslation} onClick={() => { setShowTranslation(!showTranslation); localStorage.setItem('lyricsTranslation', String(!showTranslation)); }}>翻译</button>
              <button type="button" aria-pressed={showRomanization} onClick={() => { setShowRomanization(!showRomanization); localStorage.setItem('lyricsRomanization', String(!showRomanization)); }}>音译 / 罗马音</button>
              {(showTranslation && !translatedLines.some(line => line.text) || showRomanization && !romanizedLines.some(line => line.text)) && <span>该歌曲暂无{showTranslation && !translatedLines.some(line => line.text) ? '翻译' : ''}{showTranslation && !translatedLines.some(line => line.text) && showRomanization && !romanizedLines.some(line => line.text) ? '及' : ''}{showRomanization && !romanizedLines.some(line => line.text) ? '音译' : ''}</span>}
            </div>
              {parsedLyrics.length > 0 && <div className="full-lyrics-progress">
                <span>{formatTime(currentTime)}</span>
                <input type="range" aria-label="完整歌词播放进度" min={0} max={duration || 0} step={0.1} value={Math.min(currentTime, duration || 0)} disabled={duration <= 0} onChange={event => seekTo(Number(event.target.value))} />
                <span>{formatTime(duration)}</span>
              </div>}
              <div className="full-lyrics-content" ref={fullLyricsViewport} tabIndex={0} aria-label="完整歌词，可滚动查看">
                <div className="dynamic-lyrics">
                  {parsedLyrics.map((lyric, index) => <p key={index} className={`lyric-line ${index === currentLyricIndex ? 'current-lyric' : ''}`} aria-current={index === currentLyricIndex ? 'true' : undefined}>
                    <button type="button" className="lyric-seek-button" aria-label={`从这句播放：${lyric.text || formatTime(lyric.time)}`} disabled={duration <= 0 || lyric.time > duration} onClick={() => { seekTo(Math.max(0, lyric.time)); if (!isPlaying) togglePlay(); }}>▶</button>
                    <span className="lyric-original">{lyric.text}</span>
                    {showTranslation && matchLyric(translatedLines, lyric.time) && <span className="lyric-translation">{matchLyric(translatedLines, lyric.time)}</span>}
                    {showRomanization && matchLyric(romanizedLines, lyric.time) && <span className="lyric-romanization">{matchLyric(romanizedLines, lyric.time)}</span>}
                  </p>)}
                  {!parsedLyrics.length && <p className={lyrics.trim() ? "plain-lyrics" : "no-lyrics"}>{lyrics.trim() || "暂无歌词"}</p>}
                </div>
              </div>
            </div>
          </dialog>

          {/* 互换位置：Quick Review面板放在下面 */}
          <div className="quick-review-panel annual-song-rating">{currentSong && <><h3>年度单曲榜评分</h3><SongRating key={currentSong.songmid} song={currentSong} /></>}</div><div className="quick-review-panel personal-work-review"><h3>个人乐评</h3>{currentSong ? <WorkReview inline key={currentSong.songmid} id={`${currentSong.provider || 'qq'}:song:${currentSong.songmid}`} title={currentSong.songname} artist={currentSong.singer.map(s => s.name).join(' / ')} image={songCover(currentSong)} /> : <p>选择歌曲后即可评分</p>}</div>
        </div>
      </div>
      </>}
    </div>
  );
}

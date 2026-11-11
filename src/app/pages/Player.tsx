import { CatalogPanel } from '../components/CatalogPanel';
import { WorkReview } from '../components/WorkReview';
import { songEntity, type CatalogItem } from '../services/catalog';
import { songCover, platformLyric, platformPlayableUrl } from '../services/platformSongs';
import { toast } from 'sonner';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/Player.css';
import { Repeat1, ListMusic, Shuffle } from 'lucide-react';
import { parseLrc, matchLyric } from '../services/lyrics';

export function Player({ selection, onSelectionChange }: { selection: CatalogItem | null; onSelectionChange: (value: CatalogItem | null) => void }) {
  const [view, setView] = useState<'songs' | 'albums' | 'artists'>(selection?.kind || 'songs');
  useEffect(() => { if (selection) setView(selection.kind); }, [selection]);
  const [downloading, setDownloading] = useState(false);
  const setDownloadError = (message: string) => { if (message) toast.error(message, { duration: 3000 }); };
  const [translation, setTranslation] = useState('');
  const [romanization, setRomanization] = useState('');
  const [showTranslation, setShowTranslation] = useState(() => localStorage.getItem('lyricsTranslation') === 'true');
  const [showRomanization, setShowRomanization] = useState(() => localStorage.getItem('lyricsRomanization') === 'true');
  const translatedLines = useMemo(() => parseLrc(translation), [translation]);
  const romanizedLines = useMemo(() => parseLrc(romanization), [romanization]);
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
  const { currentSong, isPlaying, togglePlay, volume, setVolume, setLyrics, lyrics, currentTime, duration, seekTo, previousSong, nextSong, playMode, setPlayMode } = useMusic();
  
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
  useEffect(() => {
    let cancelled = false;
    setTranslation(''); setRomanization('');
    const fetchLyrics = async () => {
      if (currentSong) {
        try {
          const response = await platformLyric(currentSong);
          if (cancelled) return;
          const data = response?.response || response?.data?.response || response?.data || {};
          setTranslation(typeof data.trans === 'string' ? data.trans : '');
          setRomanization(typeof data.roma === 'string' ? data.roma : '');
          console.log('获取歌词响应:', response);
          // 适配后端 API 返回的歌词数据结构
          if (response?.response?.lyric) {
            setLyrics(response.response.lyric);
          } else if (response?.data?.response?.lyric) {
            setLyrics(response.data.response.lyric);
          } else if (response?.data?.lyric) {
            setLyrics(response.data.lyric);
          }
        } catch (error) {
          console.error('获取歌词失败:', error);
        }
      }
    };
    
    fetchLyrics();
    return () => { cancelled = true; };
  }, [currentSong, setLyrics]);
  
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
  const lyricsViewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = lyricsViewport.current;
    if (!viewport) return;
    const centerCurrent = () => {
      const line = viewport.querySelector<HTMLElement>('.current-lyric');
      if (line) viewport.scrollTop += line.getBoundingClientRect().top - viewport.getBoundingClientRect().top - (viewport.clientHeight - line.clientHeight) / 2;
    };
    centerCurrent();
    const observer = new ResizeObserver(centerCurrent);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [currentLyricIndex, parsedLyrics, showTranslation, showRomanization, translation, romanization]);

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
    const startIndex = Math.max(0, currentLyricIndex - 2);
    const endIndex = Math.min(parsedLyrics.length - 1, currentLyricIndex + 2);
    return parsedLyrics.slice(startIndex, endIndex + 1);
  };

  // 计算当前显示歌词的起始索引
  const displayStartIndex = Math.max(0, currentLyricIndex - 2);
  
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
  const browsingItem = view === 'songs' ? null : selection?.kind === view ? selection : currentSong ? songEntity(currentSong, view) : null;
  const changeView = (kind: 'songs' | 'albums' | 'artists') => {
    setView(kind);
    if (kind === 'songs') onSelectionChange(null);
    else if (selection?.kind !== kind && currentSong) onSelectionChange(songEntity(currentSong, kind));
  };
  
  return (
    <div className="player-page">
      <nav className="player-view-tabs" aria-label="播放器内容">{([['songs', '歌曲'], ['albums', '专辑'], ['artists', '歌手']] as const).map(([kind, label]) => <button key={kind} aria-pressed={view === kind} disabled={kind !== 'songs' && !currentSong && selection?.kind !== kind} data-disabled-reason="请先选择歌曲，或从搜索结果打开专辑、歌手" onClick={() => changeView(kind)}>{label}</button>)}</nav>
      {view !== 'songs' ? (browsingItem ? <CatalogPanel key={`${browsingItem.provider}:${browsingItem.id}:${view}`} item={browsingItem} /> : <p>请先选择歌曲或搜索作品</p>) : <>
      <div className="player-main">
        <div className="player-left">
          {/* QQ音乐播放器 */}
          <div className="qq-music-player">
            <div className="player-header">
              <h2>播放器</h2>
            </div>
            
            <div className="player-content">
              <div className="album-cover-large">
                <img 
                  src={displayTrack.album.coverUrl} 
                  alt={displayTrack.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px' }}
                />
              </div>
              
              <div className="track-info">
                <h3 className="track-title">{currentSong ? displayTrack.name : '暂未选择歌曲'}</h3>
                {currentSong && <p className="track-artist">{displayTrack.artists.map((artist: any) => artist.name).join(', ')}</p>}
              </div>
              
              <div className="player-controls-row">
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
          </div>
        </div>

        <div className="player-right">
          {/* 互换位置：Lyrics面板放在上面 */}
          <div className="lyrics-panel">
            <div className="lyrics-header">
              <h3>歌词</h3>
              <div className="lyrics-actions">
                <button className="lyrics-btn" disabled={!parsedLyrics.length} data-disabled-reason="当前歌曲暂无歌词" onClick={async () => {
                  // 提取纯歌词文本，不包含时间戳
                  const pureLyrics = parsedLyrics.map(lyric => lyric.text).join('\n');
                  await navigator.clipboard.writeText(pureLyrics);
                  setShowCopySuccess(true);
                  setTimeout(() => setShowCopySuccess(false), 1500);
                }}>复制</button>
                <button className="lyrics-btn" disabled={!parsedLyrics.length} data-disabled-reason="当前歌曲暂无歌词" onClick={() => {
                  // 提取纯歌词文本，不包含时间戳
                  const pureLyrics = parsedLyrics.map(lyric => lyric.text).join('\n');
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
            <div className="lyrics-display-options">
              <button type="button" aria-pressed={showTranslation} onClick={() => { setShowTranslation(!showTranslation); localStorage.setItem('lyricsTranslation', String(!showTranslation)); }}>翻译</button>
              <button type="button" aria-pressed={showRomanization} onClick={() => { setShowRomanization(!showRomanization); localStorage.setItem('lyricsRomanization', String(!showRomanization)); }}>音译 / 罗马音</button>
              {(showTranslation && !translatedLines.some(line => line.text) || showRomanization && !romanizedLines.some(line => line.text)) && <span>该歌曲暂无{showTranslation && !translatedLines.some(line => line.text) ? '翻译' : ''}{showTranslation && !translatedLines.some(line => line.text) && showRomanization && !romanizedLines.some(line => line.text) ? '及' : ''}{showRomanization && !romanizedLines.some(line => line.text) ? '音译' : ''}</span>}
            </div>
            <div className="lyrics-content" ref={lyricsViewport}>
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
                <p className="no-lyrics">暂无歌词</p>
              )}
            </div>
          </div>

          {/* 互换位置：Quick Review面板放在下面 */}
          <div className="quick-review-panel"><h3>个人乐评</h3>{currentSong ? <WorkReview key={currentSong.songmid} id={`${currentSong.provider || 'qq'}:song:${currentSong.songmid}`} title={currentSong.songname} artist={currentSong.singer.map(s => s.name).join(' / ')} image={songCover(currentSong)} /> : <p>选择歌曲后即可评分</p>}</div>
        </div>
      </div>
      </>}
    </div>
  );
}

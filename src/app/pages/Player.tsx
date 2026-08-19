import React, { useEffect, useState, useMemo } from 'react';
import { qqMusicService } from '../services/qqMusicService';
import { useMusic } from '../contexts/MusicContext';
import { useRankingContext } from '../contexts/RankingContext';
import { calculateLinearScores as calculateRankingScores } from '../features/ranking/rankingLogic';
import '../../styles/Player.css';

export function Player() {
  // 使用音乐播放上下文
  const { currentSong, isPlaying, togglePlay, volume, setVolume, setLyrics, lyrics, currentTime, duration, seekTo, previousSong, nextSong, playMode, setPlayMode } = useMusic();
  
  // 使用榜单上下文
  const { rankingList, setRankingList, setRankingMode } = useRankingContext();
  
  // 复制成功提示状态
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  
  // 评论表单状态管理
  const [ratings, setRatings] = useState({
    lyrics: 0,
    composition: 0,
    arrangement: 0,
    singing: 0,
    innovation: 0,
    preference: 0
  });
  const [comment, setComment] = useState('');
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  
  // 计算总分
  const totalScore = ratings.lyrics + ratings.composition + ratings.arrangement + ratings.singing + ratings.innovation + ratings.preference;

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
    const fetchLyrics = async () => {
      if (currentSong) {
        try {
          setLyrics(await qqMusicService.getLyrics(currentSong.songmid));
        } catch (error) {
          console.error('获取歌词失败:', error);
        }
      }
    };
    
    fetchLyrics();
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
          const time = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
          parsedLyrics.push({ time, text });
        }
      }
    }

    return parsedLyrics.sort((a, b) => a.time - b.time);
  };

  // 解析后的歌词
  const parsedLyrics = useMemo(() => parseLyrics(lyrics), [lyrics]);

  // 当前歌词索引
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);

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
      coverUrl: qqMusicService.getAlbumCoverUrl(currentSong.albummid)
    }
  } : mockTrack;
  
  // 处理评分变化
  const handleRatingChange = (field: keyof typeof ratings, value: number) => {
    setRatings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // 计算线性映射十分制分数的函数
  const calculateLinearScores = (items: any[]): any[] => {
    // 计算每个作品的百分制总分，解决浮点数精度问题
    const itemsWithTotalScore = items.map(item => ({
      ...item,
      totalScore: parseFloat((item.originalScore + item.integrity + item.durability).toFixed(2))
    }));
    
    // 根据总分降序排序
    const sortedItems = [...itemsWithTotalScore].sort((a, b) => b.totalScore - a.totalScore);
    
    // 找出最高分和最低分
    const scores = sortedItems.map(item => item.totalScore);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    // 如果所有分数相同，直接返回10.0分（或平均分）并重新分配排名
    if (maxScore === minScore) {
      return sortedItems.map((item, index) => ({
        id: item.id,
        rank: index + 1,
        title: item.title,
        artist: item.artist,
        coverUrl: item.coverUrl,
        review: item.review,
        originalScore: item.originalScore,
        integrity: item.integrity,
        durability: item.durability,
        finalScore: 10.0,
        totalScore: item.totalScore
      }));
    }
    
    // 线性映射到0-10分，并重新分配排名
    return sortedItems.map((item, index) => {
      const normalizedScore = (item.totalScore - minScore) / (maxScore - minScore) * 10;
      return {
        id: item.id,
        rank: index + 1,
        title: item.title,
        artist: item.artist,
        coverUrl: item.coverUrl,
        review: item.review,
        originalScore: item.originalScore,
        integrity: item.integrity,
        durability: item.durability,
        finalScore: parseFloat(normalizedScore.toFixed(1)),
        totalScore: item.totalScore
      };
    });
  };

  // 将评分数据添加到年度单曲榜单的函数
  const addToYearlyRanking = () => {
    if (!currentSong) return;
    
    // 确保切换到年度单曲榜
    setRankingMode('年度单曲榜');
    
    // 创建新的榜单项目
    const newRankingItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      rank: 1,
      title: currentSong.songname,
      artist: currentSong.singer.map((s: any) => s.name).join(', '),
      coverUrl: qqMusicService.getAlbumCoverUrl(currentSong.albummid),
      review: comment || '没有评价的义务！',
      originalScore: totalScore,
      integrity: 0,
      durability: 0,
      finalScore: 0
    };
    
    // 检查是否是样例数据（默认的3条数据）
    const isSampleData = rankingList.length === 3 && rankingList.every(item => 
      item.id === '1' || item.id === '2' || item.id === '3'
    );
    
    let updatedList;
    if (isSampleData) {
      // 如果是样例数据，直接替换为新的榜单
      updatedList = [newRankingItem];
    } else {
      // 检查歌曲是否已存在于榜单中
      const existingIndex = rankingList.findIndex(item => 
        item.title === currentSong.songname && 
        item.artist === currentSong.singer.map((s: any) => s.name).join(', ')
      );
      
      if (existingIndex >= 0) {
        // 如果歌曲已存在，更新评分和评论
        updatedList = [...rankingList];
        updatedList[existingIndex] = {
          ...updatedList[existingIndex],
          originalScore: totalScore,
          review: comment || '没有评价的义务！'
        };
      } else {
        // 如果歌曲不存在，添加新条目
        updatedList = [...rankingList, newRankingItem];
      }
    }
    
    // 重新计算分数和排名
    const recalculatedList = calculateRankingScores(updatedList);
    
    // 更新榜单
    setRankingList(recalculatedList);
    
    console.log('成功将歌曲添加到年度单曲榜单:', newRankingItem.title);
  };

  // 处理评论提交
  const handleSubmitReview = () => {
    if (!currentSong) return;
    
    // 创建评论数据（仅用于本地日志）
    const reviewData = {
      songId: currentSong.songmid,
      songName: currentSong.songname,
      artist: currentSong.singer.map((s: any) => s.name).join(', '),
      album: currentSong.albumname,
      coverUrl: qqMusicService.getAlbumCoverUrl(currentSong.albummid),
      ratings,
      totalScore,
      comment,
      createdAt: new Date().toISOString()
    };
    
    console.log('准备提交评论数据:', reviewData);
    
    // 将评分添加到年度单曲榜单
    addToYearlyRanking();
    
    // 显示提交成功提示
    setShowSubmitSuccess(true);
    setTimeout(() => setShowSubmitSuccess(false), 2000);
    
    // 重置表单
    setRatings({
      lyrics: 0,
      composition: 0,
      arrangement: 0,
      singing: 0,
      innovation: 0,
      preference: 0
    });
    setComment('');
    
    console.log('评论和评分已成功添加到本地年度榜单');
  };

  return (
    <div className="player-page">
      <div className="player-main">
        <div className="player-left">
          {/* QQ音乐播放器 */}
          <div className="qq-music-player">
            <div className="player-header">
              <h2>QQ音乐播放器</h2>
            </div>
            
            <div className="player-content">
              <div className="album-cover">
                <img 
                  src={displayTrack.album.coverUrl} 
                  alt={displayTrack.name} 
                  className="cover-image"
                />
              </div>
              
              <div className="track-info">
                <h3 className="track-title">{displayTrack.name}</h3>
                <p className="track-artist">{displayTrack.artists.map((artist: any) => artist.name).join(', ')}</p>
              </div>
              
              <div className="player-controls-row">
                <div className="player-controls">
                  <button className="control-btn" onClick={previousSong}>
                    ⏮
                  </button>
                  <button 
                    className={`control-btn ${isPlaying ? 'pause' : 'play'}`}
                    onClick={togglePlay}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className="control-btn" onClick={nextSong}>
                    ⏭
                  </button>
                </div>
                
                <button 
                  className="control-btn playmode-btn" 
                  onClick={togglePlayMode}
                  title={getPlayModeText()}
                >
                  {getPlayModeIcon()} {getPlayModeText()}
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
                <button className="lyrics-btn" onClick={async () => {
                  // 提取纯歌词文本，不包含时间戳
                  const pureLyrics = parsedLyrics.map(lyric => lyric.text).join('\n');
                  await navigator.clipboard.writeText(pureLyrics);
                  setShowCopySuccess(true);
                  setTimeout(() => setShowCopySuccess(false), 1500);
                }}>复制</button>
                <button className="lyrics-btn" onClick={() => {
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
                        {lyric.text}
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
          <div className="quick-review-panel">
            <h3>快速评论</h3>
            <div className="review-form">
              <div className="rating-row">
                <label>歌词</label>
                <input 
                  type="number" 
                  min="0" 
                  max="25" 
                  placeholder="0-25" 
                  value={ratings.lyrics === 0 ? '' : ratings.lyrics}
                  onChange={(e) => {
                    let value = e.target.value;
                    // 移除前导零
                    if (value.length > 1 && value.startsWith('0')) {
                      value = value.replace(/^0+/, '');
                    }
                    // 确保是数字
                    const numValue = parseInt(value) || 0;
                    // 确保在范围内
                    const clampedValue = Math.max(0, Math.min(25, numValue));
                    handleRatingChange('lyrics', clampedValue);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              <div className="rating-row">
                <label>作曲</label>
                <input 
                  type="number" 
                  min="0" 
                  max="25" 
                  placeholder="0-25" 
                  value={ratings.composition === 0 ? '' : ratings.composition}
                  onChange={(e) => {
                    let value = e.target.value;
                    // 移除前导零
                    if (value.length > 1 && value.startsWith('0')) {
                      value = value.replace(/^0+/, '');
                    }
                    // 确保是数字
                    const numValue = parseInt(value) || 0;
                    // 确保在范围内
                    const clampedValue = Math.max(0, Math.min(25, numValue));
                    handleRatingChange('composition', clampedValue);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              <div className="rating-row">
                <label>编曲</label>
                <input 
                  type="number" 
                  min="0" 
                  max="25" 
                  placeholder="0-25" 
                  value={ratings.arrangement === 0 ? '' : ratings.arrangement}
                  onChange={(e) => {
                    let value = e.target.value;
                    // 移除前导零
                    if (value.length > 1 && value.startsWith('0')) {
                      value = value.replace(/^0+/, '');
                    }
                    // 确保是数字
                    const numValue = parseInt(value) || 0;
                    // 确保在范围内
                    const clampedValue = Math.max(0, Math.min(25, numValue));
                    handleRatingChange('arrangement', clampedValue);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              <div className="rating-row">
                <label>演唱</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10" 
                  placeholder="0-10" 
                  value={ratings.singing === 0 ? '' : ratings.singing}
                  onChange={(e) => {
                    let value = e.target.value;
                    // 移除前导零
                    if (value.length > 1 && value.startsWith('0')) {
                      value = value.replace(/^0+/, '');
                    }
                    // 确保是数字
                    const numValue = parseInt(value) || 0;
                    // 确保在范围内
                    const clampedValue = Math.max(0, Math.min(10, numValue));
                    handleRatingChange('singing', clampedValue);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              <div className="rating-row">
                <label>创新性</label>
                <input 
                  type="number" 
                  min="0" 
                  max="5" 
                  placeholder="0-5" 
                  value={ratings.innovation === 0 ? '' : ratings.innovation}
                  onChange={(e) => {
                    let value = e.target.value;
                    // 移除前导零
                    if (value.length > 1 && value.startsWith('0')) {
                      value = value.replace(/^0+/, '');
                    }
                    // 确保是数字
                    const numValue = parseInt(value) || 0;
                    // 确保在范围内
                    const clampedValue = Math.max(0, Math.min(5, numValue));
                    handleRatingChange('innovation', clampedValue);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              <div className="rating-row">
                <label>个人喜好</label>
                <input 
                  type="number" 
                  min="0" 
                  max="10" 
                  placeholder="0-10" 
                  value={ratings.preference === 0 ? '' : ratings.preference}
                  onChange={(e) => {
                    let value = e.target.value;
                    // 移除前导零
                    if (value.length > 1 && value.startsWith('0')) {
                      value = value.replace(/^0+/, '');
                    }
                    // 确保是数字
                    const numValue = parseInt(value) || 0;
                    // 确保在范围内
                    const clampedValue = Math.max(0, Math.min(10, numValue));
                    handleRatingChange('preference', clampedValue);
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
              <div className="total-score">
                <span>总分：</span>
                <span className="score-value">{totalScore} / 100</span>
              </div>
              <textarea
                className="review-comment"
                placeholder="在此写下你的评论..."
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              ></textarea>
              <button 
                className="submit-review-btn"
                onClick={handleSubmitReview}
              >
                提交评论
              </button>
              {showSubmitSuccess && (
                <div className="submit-success-toast">
                  评论提交成功！
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

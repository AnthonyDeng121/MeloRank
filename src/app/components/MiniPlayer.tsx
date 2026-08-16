import React from 'react';
import { useMusic } from '../contexts/MusicContext';
import '../../styles/MiniPlayer.css';

// 格式化时间
const formatTime = (seconds: number): string => {
  // 处理NaN和无效值情况
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export function MiniPlayer() {
  // 使用音乐播放上下文
  const { currentSong, isPlaying, togglePlay, currentTime, duration, seekTo, previousSong, nextSong, playMode, setPlayMode } = useMusic();

  // 播放模式切换
  const togglePlayMode = () => {
    const modes: Array<'single' | 'sequence' | 'random'> = ['single', 'sequence', 'random'];
    const currentModeIndex = modes.indexOf(playMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setPlayMode(nextMode);
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
      coverUrl: `https://y.qq.com/music/photo_new/T002R300x300M000${currentSong.albummid}.jpg`
    }
  } : mockTrack;

  // 处理进度条点击事件
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = percent * duration;
    if (duration > 0) {
      seekTo(newTime);
    }
  };

  return (
    <div className="mini-player">
      <div className="mini-player-top">
        <div className="mini-player-cover">
          <img 
            src={displayTrack.album.coverUrl} 
            alt={displayTrack.name} 
            className="mini-player-image"
          />
        </div>
        <div className="mini-player-info">
          <div className="mini-player-title">{displayTrack.name}</div>
          <div className="mini-player-artist">
            {displayTrack.artists.map((artist: any) => artist.name).join(', ')}
          </div>
        </div>
        <div className="mini-player-controls">
          <button className="mini-control-btn" onClick={previousSong}>
            ⏮
          </button>
          <button 
            className={`mini-control-btn ${isPlaying ? 'pause' : 'play'}`}
            onClick={togglePlay}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="mini-control-btn" onClick={nextSong}>
            ⏭
          </button>
          <button 
            className="mini-control-btn playmode-btn" 
            onClick={togglePlayMode}
            title={`播放模式: ${playMode === 'single' ? '单曲循环' : playMode === 'sequence' ? '顺序播放' : '随机播放'}`}
          >
            {getPlayModeIcon()}
          </button>
        </div>
      </div>
      <div className="mini-player-bottom">
        <div className="mini-player-progress-container">
          <div className="mini-player-progress-time">{formatTime(currentTime)}</div>
          <div 
            className="mini-player-progress-bar"
            onClick={handleProgressClick}
            style={{ visibility: 'visible' }}
          >
            <div 
              className="mini-player-progress-fill"
              style={{ 
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                visibility: 'visible'
              }}
            ></div>
            <div 
              className="mini-player-progress-handle"
              style={{ 
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                visibility: 'visible'
              }}
            ></div>
          </div>
          <div className="mini-player-progress-time">{formatTime(duration)}</div>
        </div>
      </div>
    </div>
  );
}
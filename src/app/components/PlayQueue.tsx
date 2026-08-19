import React from 'react';
import { useMusic } from '../contexts/MusicContext';
import { qqMusicService } from '../services/qqMusicService';
import '../../styles/PlayQueue.css';

interface PlayQueueProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PlayQueue: React.FC<PlayQueueProps> = ({ isVisible, onClose }) => {
  const {
    playQueue,
    currentSong,
    currentIndex,
    setCurrentSong,
    removeSongFromQueue,
    clearPlayQueue,
    playMode,
    setPlayMode
  } = useMusic();

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

  if (!isVisible) {
    return null;
  }

  return (
    <div className="playqueue-overlay" onClick={onClose}>
      <div className="playqueue-container" onClick={(e) => e.stopPropagation()}>
        <div className="playqueue-header">
          <h2>播放队列</h2>
          <div className="playqueue-actions">
            <button 
              className="playmode-btn" 
              onClick={togglePlayMode}
              title={getPlayModeText()}
            >
              {getPlayModeIcon()} {getPlayModeText()}
            </button>
            <button 
              className="clear-btn" 
              onClick={clearPlayQueue}
              disabled={playQueue.length === 0}
            >
              清空队列
            </button>
            <button className="close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="playqueue-content">
          {playQueue.length === 0 ? (
            <div className="empty-queue">
              <p>播放队列为空</p>
              <p>搜索歌曲并添加到队列</p>
            </div>
          ) : (
            <ul className="queue-list">
              {playQueue.map((song, index) => (
                <li 
                  key={song.songmid} 
                  className={`queue-item ${index === currentIndex ? 'current' : ''}`}
                >
                  <div className="queue-item-info">
                    <div className="queue-item-index">
                      {index === currentIndex ? (
                        <span className="playing-indicator">▶️</span>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="queue-item-cover">
                      {song.albummid && (
                        <img 
                          src={qqMusicService.getAlbumCoverUrl(song.albummid)}
                          alt={song.songname} 
                          className="album-image" 
                        />
                      )}
                    </div>
                    <div className="queue-item-details">
                      <div className="queue-item-title">{song.songname}</div>
                      <div className="queue-item-subtitle">
                        {song.singer?.map((artist: any) => artist.name).join(', ')} · {song.albumname}
                      </div>
                    </div>
                  </div>
                  <div className="queue-item-actions">
                    <button 
                      className="play-btn" 
                      onClick={() => setCurrentSong(song)}
                    >
                      播放
                    </button>
                    <button 
                      className="remove-btn" 
                      onClick={() => removeSongFromQueue(index)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="playqueue-footer">
          <div className="queue-info">
            共 {playQueue.length} 首歌曲
          </div>
        </div>
      </div>
    </div>
  );
};

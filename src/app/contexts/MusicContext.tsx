import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { qqMusicService } from '../services/qqMusicService';
import { dataAPI } from '../services/apiService';

// 歌曲类型定义
interface Song {
  songmid: string;
  songname: string;
  singer: Array<{ name: string; mid: string }>;
  albumname: string;
  albummid: string;
  duration?: number;
  url?: string;
}

// 播放模式类型
type PlayMode = 'single' | 'sequence' | 'random';

// 播放状态类型定义
interface MusicContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  lyrics: string;
  playMode: PlayMode;
  playQueue: Song[];
  currentIndex: number;
  setCurrentSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  setLyrics: (lyrics: string) => void;
  setPlayMode: (mode: PlayMode) => void;
  addSongToQueue: (song: Song) => void;
  removeSongFromQueue: (index: number) => void;
  clearPlayQueue: () => void;
  nextSong: () => void;
  previousSong: () => void;
}

// 创建上下文
const MusicContext = createContext<MusicContextType | undefined>(undefined);

// 上下文提供者组件
interface MusicProviderProps {
  children: ReactNode;
}

export const MusicProvider: React.FC<MusicProviderProps> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70); // 默认音量70%
  const [currentTime, setCurrentTime] = useState(0); // 当前播放时间（秒）
  const [duration, setDuration] = useState(0); // 歌曲总时长（秒）
  const [lyrics, setLyrics] = useState('');
  const [playMode, setPlayMode] = useState<PlayMode>('single'); // 默认单曲循环
  const [playQueue, setPlayQueue] = useState<Song[]>([]); // 播放队列
  const [currentIndex, setCurrentIndex] = useState(-1); // 当前歌曲在队列中的索引
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 使用useCallback包装nextSong和previousSong函数，确保它们总是使用最新的状态
  const nextSong = React.useCallback(() => {
    if (playQueue.length === 0) return;

    let nextIndex: number;
    
    switch (playMode) {
      case 'single':
        // 单曲循环，重新播放当前歌曲
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          // 设置isPlaying为true，确保歌曲会继续播放
          setIsPlaying(true);
          audioRef.current.play().catch(error => console.error('播放失败:', error));
        }
        return;
      
      case 'sequence':
        // 顺序播放，播放下一首，到达末尾时自动暂停
        if (currentIndex === playQueue.length - 1) {
          // 已到达最后一首，自动暂停
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.pause();
          }
          return;
        }
        nextIndex = currentIndex + 1;
        break;
      
      case 'random':
        // 随机播放，随机选择队列中的一首歌曲，避免连续播放同一首
        if (playQueue.length === 1) {
          nextIndex = 0;
        } else {
          do {
            nextIndex = Math.floor(Math.random() * playQueue.length);
          } while (nextIndex === currentIndex);
        }
        break;
      
      default:
        nextIndex = 0;
    }
    
    setCurrentIndex(nextIndex);
    setCurrentSong(playQueue[nextIndex]);
  }, [playQueue, playMode, currentIndex, setIsPlaying, setCurrentIndex, setCurrentSong]);

  const previousSong = React.useCallback(() => {
    if (playQueue.length === 0) return;
    
    let prevIndex: number;
    
    switch (playMode) {
      case 'single':
        // 单曲循环，重新播放当前歌曲
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          // 设置isPlaying为true，确保歌曲会继续播放
          setIsPlaying(true);
          audioRef.current.play().catch(error => console.error('播放失败:', error));
        }
        return;
      
      case 'sequence':
        // 顺序播放，播放上一首，到达开头时循环到末尾
        prevIndex = currentIndex === 0 ? playQueue.length - 1 : currentIndex - 1;
        break;
      
      case 'random':
        // 随机播放，随机选择队列中的一首歌曲，避免连续播放同一首
        if (playQueue.length === 1) {
          prevIndex = 0;
        } else {
          do {
            prevIndex = Math.floor(Math.random() * playQueue.length);
          } while (prevIndex === currentIndex);
        }
        break;
      
      default:
        prevIndex = 0;
    }
    
    setCurrentIndex(prevIndex);
    setCurrentSong(playQueue[prevIndex]);
  }, [playQueue, playMode, currentIndex, setIsPlaying, setCurrentIndex, setCurrentSong]);

  // 初始化audio元素
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      // 设置初始音量
      audioRef.current.volume = volume / 100;
    }
    
    // 监听播放和暂停事件
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      nextSong();
    };
    // 监听播放时间更新事件
    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };
    // 监听总时长变化事件
    const handleDurationChange = () => {
      if (audioRef.current) {
        setDuration(audioRef.current.duration);
      }
    };
    
    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('durationchange', handleDurationChange);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('durationchange', handleDurationChange);
      }
    };
  }, [nextSong, volume, setIsPlaying, setCurrentTime, setDuration]);

  // 当音量变化时，更新音频元素的音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);



  // 当currentSong变化时，获取播放URL并播放
  useEffect(() => {
    const playSong = async () => {
      if (currentSong && audioRef.current) {
        try {
          // 获取歌曲播放URL
          console.log('获取歌曲播放URL，songmid:', currentSong.songmid);
          const response = await qqMusicService.getSongUrl(currentSong.songmid);
          console.log('获取歌曲播放URL响应:', response);
          
          // 处理响应，获取播放URL
          let songUrl = '';
          let errorMessage = '';
          
          // 适配不同的API返回格式
          if (response.data) {
            // 情况1: { data: { playUrl: { songmid: { url: string } } } } 格式
            if (response.data.playUrl && response.data.playUrl[currentSong.songmid]) {
              const songInfo = response.data.playUrl[currentSong.songmid];
              if (songInfo) {
                if (songInfo.url) {
                  songUrl = songInfo.url;
                }
                if (songInfo.error) {
                  errorMessage = songInfo.error;
                }
              }
            }
            // 情况2: { data: { url: string } } 格式
            else if (response.data.url) {
              songUrl = response.data.url;
            }
            // 情况3: { data: [{ url: string }] } 格式
            else if (Array.isArray(response.data) && response.data[0]?.url) {
              songUrl = response.data[0].url;
            }
          }
          // 情况4: 直接返回 { url: string } 格式
          else if (response.url) {
            songUrl = response.url;
          }
          // 情况5: 直接返回 { playUrl: string } 格式
          else if (response.playUrl) {
            songUrl = response.playUrl;
          }
          
          console.log('使用歌曲播放URL:', songUrl);
          console.log('歌曲错误信息:', errorMessage);
          
          if (songUrl) {
              // 设置audio元素的src
              audioRef.current.src = songUrl;
              
              // 设置isPlaying为true，确保歌曲会播放
              setIsPlaying(true);
              // 立即调用play方法，确保歌曲播放
              audioRef.current.play().catch(error => console.error('播放失败:', error));
            } else {
              console.error('未能获取到有效的歌曲播放URL');
              // 显示适当的错误提示
              if (errorMessage) {
                alert('无法播放该歌曲: ' + errorMessage);
              } else {
                alert('无法播放该歌曲，可能是VIP专属或版权受限');
              }
          }
        } catch (error) {
          console.error('播放歌曲失败:', error);
          // 显示更友好的错误提示
          alert('播放失败，请检查网络连接或稍后重试');
        }
      }
    };
    
    playSong();
  }, [currentSong]);

  // 当currentSong变化时，获取歌词
  useEffect(() => {
    const fetchLyrics = async () => {
      if (currentSong) {
        try {
          console.log('获取歌词，songmid:', currentSong.songmid);
          const response = await qqMusicService.getLyric(currentSong.songmid);
          console.log('获取歌词响应:', response);
          
          // 适配不同的API返回格式
          let lyricText = '';
          
          // 情况1: { response: { lyric: string } } 格式
          if (response.response?.lyric) {
            lyricText = response.response.lyric;
          }
          // 情况2: { data: { response: { lyric: string } } } 格式
          else if (response.data?.response?.lyric) {
            lyricText = response.data.response.lyric;
          }
          // 情况3: { data: { lyric: string } } 格式
          else if (response.data?.lyric) {
            lyricText = response.data.lyric;
          }
          
          console.log('获取到歌词:', lyricText);
          setLyrics(lyricText);
        } catch (error) {
          console.error('获取歌词失败:', error);
          setLyrics('');
        }
      } else {
        setLyrics('');
      }
    };
    
    fetchLyrics();
  }, [currentSong]);

  // 当isPlaying变化时，控制播放或暂停
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(error => console.error('播放失败:', error));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // 播放/暂停切换
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(error => console.error('播放失败:', error));
      }
    }
  };

  // 手动设置当前播放时间
  const handleSetCurrentTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 更新 setCurrentSong 方法，支持传入播放队列
  const updateCurrentSong = (song: Song, queue?: Song[]) => {
    setCurrentSong(song);
    
    if (queue) {
      // 如果提供了队列，使用该队列
      setPlayQueue(queue);
      const index = queue.findIndex(item => item.songmid === song.songmid);
      setCurrentIndex(index !== -1 ? index : 0);
    } else if (currentIndex === -1 || currentSong?.songmid !== song.songmid) {
      // 如果没有提供队列，但当前歌曲不在队列中，添加到队列
      const updatedQueue = [...playQueue];
      const existingIndex = updatedQueue.findIndex(item => item.songmid === song.songmid);
      
      if (existingIndex === -1) {
        // 如果歌曲不在队列中，添加到队列末尾
        updatedQueue.push(song);
        setPlayQueue(updatedQueue);
        setCurrentIndex(updatedQueue.length - 1);
      } else {
        // 如果歌曲已在队列中，更新当前索引
        setCurrentIndex(existingIndex);
      }
    }
  };

  // 添加歌曲到队列
  const addSongToQueue = (song: Song) => {
    if (!playQueue.some(item => item.songmid === song.songmid)) {
      setPlayQueue([...playQueue, song]);
    }
  };

  // 从队列中移除歌曲
  const removeSongFromQueue = (index: number) => {
    if (index >= 0 && index < playQueue.length) {
      const updatedQueue = playQueue.filter((_, i) => i !== index);
      setPlayQueue(updatedQueue);
      
      // 如果移除的是当前播放的歌曲，调整当前索引
      if (index === currentIndex) {
        if (updatedQueue.length > 0) {
          // 播放下一首，如果是最后一首则播放第一首
          const newIndex = Math.min(index, updatedQueue.length - 1);
          setCurrentIndex(newIndex);
          setCurrentSong(updatedQueue[newIndex]);
        } else {
          // 队列为空，重置状态
          setCurrentIndex(-1);
          setCurrentSong(null);
        }
      } else if (index < currentIndex) {
        // 如果移除的是当前索引之前的歌曲，调整当前索引
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  // 清空播放队列
  const clearPlayQueue = () => {
    setPlayQueue([]);
    setCurrentIndex(-1);
    setCurrentSong(null);
  };

  const value: MusicContextType = {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    lyrics,
    playMode,
    playQueue,
    currentIndex,
    setCurrentSong: updateCurrentSong,
    togglePlay,
    setIsPlaying,
    setVolume,
    seekTo: handleSetCurrentTime,
    setLyrics,
    setPlayMode,
    addSongToQueue,
    removeSongFromQueue,
    clearPlayQueue,
    nextSong,
    previousSong
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
    </MusicContext.Provider>
  );
};

// 自定义钩子，用于在组件中使用上下文
export const useMusic = (): MusicContextType => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

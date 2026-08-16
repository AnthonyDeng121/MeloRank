import React, { useState, useRef, useEffect } from 'react';
import '../../styles/AudioLab.css';

export function AudioLab() {
  // 状态管理
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [pitchShift, setPitchShift] = useState(0);
  const [startTime, setStartTime] = useState('0:00');
  const [endTime, setEndTime] = useState('0:00');
  const [volume, setVolume] = useState(70); // 默认音量70%
  
  // 引用
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      // 创建音频元素获取时长
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        setEndTime(formatTime(audio.duration));
      };
    }
  };
  
  // 处理拖拽上传
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
        setEndTime(formatTime(audio.duration));
      };
    }
  };
  
  // 格式化时间
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 解析时间字符串为秒
  const parseTime = (timeStr: string): number => {
    const [mins, secs] = timeStr.split(':').map(Number);
    return mins * 60 + secs;
  };
  
  // 处理音频播放/暂停
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  // 更新当前播放时间
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  // 处理音调变化
  const handlePitchChange = (delta: number) => {
    const newPitch = Math.max(-12, Math.min(12, pitchShift + delta));
    setPitchShift(newPitch);
    
    // 调整playbackRate来改变音调，同时保持播放速度
    if (audioRef.current) {
      const pitchRatio = Math.pow(2, newPitch / 12);
      // 计算最终的播放速率：播放速度 * 音调比率
      const finalRate = playbackRate * pitchRatio;
      audioRef.current.playbackRate = finalRate;
    }
  };
  
  // 处理播放速度变化
  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    
    // 调整playbackRate来改变播放速度，同时保持音调
    if (audioRef.current) {
      const pitchRatio = Math.pow(2, pitchShift / 12);
      // 计算最终的播放速率：播放速度 * 音调比率
      const finalRate = rate * pitchRatio;
      audioRef.current.playbackRate = finalRate;
    }
  };
  
  // 处理音量变化
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };
  
  // 应用音频修剪
  const applyTrim = () => {
    if (audioRef.current) {
      const start = parseTime(startTime);
      const end = parseTime(endTime);
      
      if (start < end && end <= duration) {
        audioRef.current.currentTime = start;
        
        // 设置结束时间监听
        const handleTimeUpdate = () => {
          if (audioRef.current && audioRef.current.currentTime >= end) {
            audioRef.current.pause();
            audioRef.current.currentTime = start;
            setIsPlaying(false);
          }
        };
        
        // 移除之前的监听器（如果有）
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        // 添加新的监听器
        audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      }
    }
  };
  
  // 使用离线音频上下文处理并导出音频
  const processAudioOffline = async (): Promise<Blob | null> => {
    if (!audioFile) return null;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 计算修剪后的开始和结束时间
      const startSeconds = parseTime(startTime);
      const endSeconds = parseTime(endTime);
      const trimDuration = endSeconds - startSeconds;
      
      // 创建离线音频上下文
      const offlineContext = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
        audioBuffer.numberOfChannels,
        Math.ceil(trimDuration * audioContext.sampleRate),
        audioContext.sampleRate
      );
      
      // 创建源节点
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // 应用速度和音调变化
      const pitchRatio = Math.pow(2, pitchShift / 12);
      source.playbackRate.value = playbackRate * pitchRatio;
      
      // 连接节点
      source.connect(offlineContext.destination);
      
      // 开始播放（从修剪的开始时间）
      source.start(0, startSeconds);
      source.stop(trimDuration / (playbackRate * pitchRatio));
      
      // 渲染音频
      const renderedBuffer = await offlineContext.startRendering();
      
      // 将AudioBuffer转换为Blob
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      audioContext.close();
      return wavBlob;
    } catch (error) {
      console.error('处理音频失败:', error);
      return null;
    }
  };
  
  // 将AudioBuffer转换为WAV格式的Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    const channels: Float32Array[] = [];
    let pos = 0;
    
    // 写入WAV头
    const setUint16 = (data: number) => {
      view.setUint16(pos, data, true);
      pos += 2;
    };
    
    const setUint32 = (data: number) => {
      view.setUint32(pos, data, true);
      pos += 4;
    };
    
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length
    
    // 写入通道数据
    for (let i = 0; i < numOfChan; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    for (let i = 0; i < buffer.length; i++) {
      for (let chan = 0; chan < numOfChan; chan++) {
        let sample = Math.max(-1, Math.min(1, channels[chan][i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };
  
  // 保存处理后的音频
  const saveAudio = async () => {
    const processedBlob = await processAudioOffline();
    if (processedBlob) {
      const url = URL.createObjectURL(processedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `processed_${audioFile?.name || 'audio'}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };
  
  return (
    <div className="audio-lab-page">
      <h2>音频实验室</h2>

      <div className="upload-section">
        <div 
          className="upload-area"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="upload-icon">🎵</div>
          <p>点击上传或拖拽音频文件到此处</p>
          <input 
            type="file" 
            accept="audio/*" 
            className="file-input"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {audioFile && (
        <>
          <div className="audio-player-section">
            <h3>音频播放器</h3>
            <div className="audio-controls">
              <audio
                ref={audioRef}
                src={audioUrl}
                onTimeUpdate={(e) => {
                  console.log('Time update:', e.currentTarget.currentTime);
                  setCurrentTime(e.currentTarget.currentTime);
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
                onLoadedMetadata={(e) => {
                  console.log('Loaded metadata:', e.currentTarget.duration);
                  setDuration(e.currentTarget.duration);
                  setEndTime(formatTime(e.currentTarget.duration));
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {/* 音频进度条 */}
              <div className="player-progress-section">
                <div className="player-controls">
                  <button className="play-btn" onClick={togglePlay}>
                    {isPlaying ? '⏸️' : '▶️'}
                  </button>
                  <div className="time-display">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                  <div className="volume-control-container">
                    <span className="volume-icon">🔊</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="volume-slider"
                    />
                    <span className="volume-value">{volume}%</span>
                  </div>
                </div>
                <div className="progress-container">
                  <div 
                    className="progress-bar"
                    onClick={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      const newTime = percent * duration;
                      if (audioRef.current && duration > 0) {
                        audioRef.current.currentTime = newTime;
                        setCurrentTime(newTime);
                      }
                    }}
                  >
                    <div 
                      className="progress-fill"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    ></div>
                    <div 
                      className="progress-handle"
                      style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const progressBar = e.currentTarget.parentElement as HTMLElement;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const rect = progressBar.getBoundingClientRect();
                          const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                          const newTime = percent * duration;
                          if (audioRef.current && duration > 0) {
                            audioRef.current.currentTime = newTime;
                            setCurrentTime(newTime);
                          }
                        };
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="waveform-section">
            <h3>音频波形</h3>
            <div className="waveform-placeholder">
              <div className="waveform-bars">
                {Array.from({ length: 100 }).map((_, i) => (
                  <div
                    key={i}
                    className="waveform-bar"
                    style={{ height: `${Math.random() * 100}%` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>

          <div className="controls-section">
            <div className="control-group">
              <h3>修剪音频</h3>
              <div className="control-row">
                <div className="control-item">
                  <label>开始时间</label>
                  <input 
                    type="text" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="0:00" 
                  />
                </div>
                <div className="control-item">
                  <label>结束时间</label>
                  <input 
                    type="text" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder={formatTime(duration)} 
                  />
                </div>
                <button className="control-btn" onClick={applyTrim}>应用修剪</button>
              </div>
            </div>

            <div className="control-group">
              <h3>播放速度</h3>
              <div className="control-row">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    className={`speed-btn ${playbackRate === rate ? 'active' : ''}`}
                    onClick={() => handlePlaybackRateChange(rate)}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <h3>音调调整</h3>
              <div className="control-row">
                <button 
                  className="pitch-btn"
                  onClick={() => handlePitchChange(-1)}
                >
                  ▼ 降低
                </button>
                <span className="pitch-value">{pitchShift} 半音</span>
                <button 
                  className="pitch-btn"
                  onClick={() => handlePitchChange(1)}
                >
                  ▲ 升高
                </button>
              </div>
            </div>
            

          </div>

          <div className="save-section">
            <button className="save-project-btn" onClick={saveAudio}>保存音频</button>
          </div>
        </>
      )}
    </div>
  );
}

export default AudioLab;
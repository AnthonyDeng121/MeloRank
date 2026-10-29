import { AudioTrimDialog } from '../components/AudioTrimDialog';
import { processPcm } from '../services/audioProcessing';
import React, { useState, useRef, useEffect } from 'react';
import '../../styles/AudioLab.css';
import { qqMusicService } from '../services/qqMusicService';
import { useMusic } from '../contexts/MusicContext';

export function AudioLab() {
  const { currentSong, setIsPlaying: setGlobalPlaying } = useMusic();
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [sourceError, setSourceError] = useState('');
  const sourceRequest = useRef(0);
  const searchSongs = async () => {
    if (!query.trim()) return;
    const id = ++sourceRequest.current;
    setBusy(true); setSourceError('');
    try {
      const result = await qqMusicService.search(query.trim(), 10);
      const response = result.response || result;
      const data = response.data || response;
      if (id === sourceRequest.current) {
        setSongs(data.song?.list || []);
        if (!data.song?.list?.length) setSourceError('没有找到歌曲，请尝试其他关键词');
      }
    } catch { if (id === sourceRequest.current) setSourceError('搜索失败，请稍后重试'); }
    finally { if (id === sourceRequest.current) setBusy(false); }
  };
  const importSong = async (song: any) => {
    setBusy(true); setSourceError('');
    try {
      const url = await qqMusicService.getPlayableUrl(song.songmid);
      const response = await fetch(url);
      if (!response.ok) throw new Error('音源下载失败');
      const blob = await response.blob();
      if (!blob.size || blob.type.includes('text') || blob.type.includes('json')) throw new Error('音源无效');
      const file = new File([blob], `${song.songname}.mp3`, { type: blob.type || 'audio/mpeg' });
      setGlobalPlaying(false);
      setAudioFile(file); setAudioUrl(URL.createObjectURL(file));
      setIsPlaying(false); setCurrentTime(0);
      setPlaybackRate(1); setPitchShift(0);
    } catch (error) {
      setSourceError(`${error instanceof Error ? error.message : '导入失败'}。音源需允许跨域读取；也可上传本地音频。`);
    } finally { setBusy(false); }
  };
  // 状态管理
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [trim, setTrim] = useState<[number, number] | null>(null);
  const [original, setOriginal] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [pitchShift, setPitchShift] = useState(0);
  const [volume, setVolume] = useState(20);
  
  // 引用
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => () => { if (audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  
  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      // 创建音频元素获取时长

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
  const handlePitchChange = (delta: number) => setPitchShift(p => Math.max(-12, Math.min(12, p + delta)));
  const handlePlaybackRateChange = (rate: number) => setPlaybackRate(rate);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };
  
  // 应用音频修剪
  useEffect(() => {
    let cancelled = false;
    setOriginal(null); setTrim(null); setTrimOpen(false); setPlaybackRate(1); setPitchShift(0);
    setPreviewUrl(''); setCurrentTime(0); setIsPlaying(false);
    if (!audioFile) return;
    const context = new AudioContext();
    audioFile.arrayBuffer().then(data => context.decodeAudioData(data)).then(buffer => {
      if (cancelled) return;
      setOriginal(buffer);
    }).catch(() => { if (!cancelled) setSourceError('无法解码此音频'); }).finally(() => context.close());
    return () => { cancelled = true; };
  }, [audioFile]);

  useEffect(() => {
    if (!original) return;
    let cancelled = false;
    let objectUrl = '';
    setProcessing(true); setPreviewUrl(''); setSourceError('');
    audioRef.current?.pause();
    const timer = setTimeout(async () => {
      try {
        const channels = Array.from({ length: original.numberOfChannels }, (_, c) => original.getChannelData(c));
        const pcm = await processPcm(channels, original.sampleRate, trim?.[0] ?? 0, trim?.[1] ?? original.duration, playbackRate, pitchShift, () => cancelled);
        if (cancelled) return;
        const buffer = new AudioBuffer({ numberOfChannels: pcm.length, length: pcm[0].length, sampleRate: original.sampleRate });
        pcm.forEach((channel, c) => buffer.getChannelData(c).set(channel));
        objectUrl = URL.createObjectURL(audioBufferToWav(buffer));
        setPreviewUrl(objectUrl); setCurrentTime(0);
      } catch (error) {
        if (!cancelled) setSourceError(error instanceof Error ? error.message : '音频处理失败');
      } finally { if (!cancelled) setProcessing(false); }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [original, trim, playbackRate, pitchShift]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume / 100; }, [volume, previewUrl]);

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
    if (!previewUrl || processing) { setSourceError('请等待音频处理完成'); return; }
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `processed_${audioFile?.name.replace(/\.[^.]+$/, '') || 'audio'}.wav`;
    document.body.appendChild(link); link.click(); link.remove();
  };

  return (
    <div className="audio-lab-page">
      <h2>音频实验室</h2>
      <section className="lab-song-picker">
        <h3>从歌曲开始制作</h3>
        <form onSubmit={e => { e.preventDefault(); searchSongs(); }}>
          <input aria-label="搜索制作音源" placeholder="搜索歌曲或歌手" value={query} onChange={e => setQuery(e.target.value)} />
          <button disabled={busy || !query.trim()}>搜索</button>
          {currentSong && <button type="button" disabled={busy} onClick={() => importSong(currentSong)}>使用当前播放歌曲</button>}
        </form>
        {busy && <p role="status">正在加载音源…</p>}
        {sourceError && <p role="alert">{sourceError}</p>}
        {songs.map(song => <div className="lab-song-result" key={song.songmid}>
          <span>{song.songname} · {song.singer?.map((s: any) => s.name).join(', ')}</span>
          <button disabled={busy} onClick={() => importSong(song)}>选择制作</button>
        </div>)}
        {audioFile && <p>当前素材：{audioFile.name}</p>}
      </section>

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

      {trimOpen && original && <AudioTrimDialog buffer={original} selection={trim} tempo={playbackRate} pitch={pitchShift} volume={volume} onClose={() => setTrimOpen(false)} onApply={range => { setTrim(range); setTrimOpen(false); }} />}
      {audioFile && (
        <>
          <div className="audio-player-section">
            <h3>音频播放器</h3>
            {processing && <p role="status">正在处理音频…</p>}
            <div className="audio-controls">
              <audio
                ref={audioRef}
                src={previewUrl || undefined}
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

                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {/* 音频进度条 */}
              <div className="player-progress-section">
                <div className="player-controls">
                  <button className="play-btn" onClick={togglePlay} disabled={processing || !previewUrl}>
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

          <div className="controls-section">
            <div className="control-group">
              <button className="lab-trim-open" onClick={() => { audioRef.current?.pause(); setTrimOpen(true); }} disabled={!original}>修剪音频</button>
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
            <button className="save-project-btn" onClick={saveAudio} disabled={processing || !previewUrl}>保存音频</button>
          </div>
        </>
      )}
    </div>
  );
}

export default AudioLab;

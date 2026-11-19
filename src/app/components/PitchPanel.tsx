import React, { useEffect, useRef, useState } from 'react';
import '../../styles/PitchPanel.css';

type Track = { hop: number; hz: number[]; duration: number; loadSeconds: number; analysisSeconds: number; cached: boolean };
const memory = new Map<string, Track>();
const note = (hz: number) => {
  if (!hz) return '—';
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
};

export function PitchPanel({ sourceKey, getAudio, currentTime, unavailable }: { sourceKey: string; getAudio: () => Promise<ArrayBuffer>; currentTime: number; unavailable?: string }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    generation.current++; controller.current?.abort(); setBusy(false); setStatus(''); setTrack(memory.get(sourceKey) || null);
    return () => { generation.current++; controller.current?.abort(); };
  }, [sourceKey]);
  const analyze = async () => {
    const id = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setStatus('正在读取音频…');
    let context: AudioContext | null = null;
    try {
      const data = await getAudio();
      if (id !== generation.current) return;
      context = new AudioContext();
      const buffer = await context.decodeAudioData(data);
      if (buffer.duration > 600) throw new Error('当前试验版支持 10 分钟以内的音频');
      const renderer = new OfflineAudioContext(1, Math.ceil(buffer.duration * 16000), 16000);
      const source = renderer.createBufferSource(); source.buffer = buffer; source.connect(renderer.destination); source.start();
      const pcm = (await renderer.startRendering()).getChannelData(0);
      if (id !== generation.current) return;
      setStatus('RMVPE 正在分析，首次使用需要加载模型；歌曲可继续播放…');
      const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000'}/api/pitch`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: pcm.slice().buffer, signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '分析失败');
      if (!Array.isArray(result.hz) || result.hop !== .01) throw new Error('音高数据无效');
      if (id === generation.current) { memory.set(sourceKey, result); while (memory.size > 10) memory.delete(memory.keys().next().value!); setTrack(result); setStatus(''); }
    } catch (error) { if (id === generation.current) setStatus(error instanceof Error ? error.message : '分析失败，请重试'); }
    finally { await context?.close(); if (id === generation.current) setBusy(false); }
  };
  const hz = track?.hz[Math.floor(currentTime / track.hop)] || 0;
  const midi = hz ? 69 + 12 * Math.log2(hz / 440) : 0;
  const start = Math.max(0, currentTime - 10);
  const low = 36, high = 96;
  const paths: string[] = [];
  let path = '';
  if (track) for (let i = Math.floor(start / track.hop); i < Math.min(track.hz.length, Math.ceil((start + 15) / track.hop)); i += 3) {
    const f = track.hz[i];
    if (!f) { if (path) paths.push(path); path = ''; continue; }
    const m = 69 + 12 * Math.log2(f / 440);
    if (m < low || m > high) { if (path) paths.push(path); path = ''; continue; }
    path += `${path ? 'L' : 'M'}${48 + (i * track.hop - start) / 15 * 742},${12 + (high - m) / (high - low) * 260} `;
  }
  if (path) paths.push(path);
  const message = unavailable || status || (track ? `${track.cached ? '已读取缓存' : '分析完成'} · 模型加载 ${track.loadSeconds.toFixed(1)} 秒 · 推理 ${track.analysisSeconds.toFixed(1)} 秒` : '点击分析后随播放显示音名和曲线；无人声时曲线留空。');
  return <section className="pitch-panel" aria-label="人声音高分析">
    <div className="pitch-heading">
      <span className="pitch-title">人声音高 <small>RMVPE · 实验</small></span>
      <div className="pitch-reading"><strong>{note(hz)}</strong><span>{hz ? `${hz.toFixed(1)} Hz · ${Math.round((midi - Math.round(midi)) * 100)} 音分` : '等待人声音高'}</span></div>
      <p className="pitch-status" role="status">{message}</p>
      <button className="pitch-analyze-button" onClick={analyze} disabled={busy || !!unavailable || !sourceKey} aria-busy={busy} data-disabled-reason={busy ? '正在分析' : unavailable || '请先选择歌曲'}>{busy ? '正在分析' : track ? '重新分析' : '分析音高'}</button>
    </div>
    <svg viewBox="0 0 800 306" preserveAspectRatio="none" role="img" aria-label="最近十五秒的人声音高曲线，横轴时间，纵轴音名">
      {[36, 48, 60, 72, 84, 96].map(m => { const y = 12 + (high - m) / 60 * 260; return <g key={m}><text x="0" y={y + 4}>{note(440 * 2 ** ((m - 69) / 12))}</text><line x1="45" x2="790" y1={y} y2={y} className="pitch-grid" /></g>; })}
      {paths.map((d, i) => <path key={i} d={d} className="pitch-curve" />)}
      {track && <line x1={48 + (currentTime - start) / 15 * 742} x2={48 + (currentTime - start) / 15 * 742} y1="10" y2="274" className="pitch-cursor" />}
      {[0, 5, 10, 15].map(t => <text key={t} x={48 + t / 15 * 730} y="299">{Math.floor(start + t)}s</text>)}
    </svg>

  </section>;
}

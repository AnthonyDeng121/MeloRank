import React, { useEffect, useMemo, useRef, useState } from 'react';
import { pitchRange } from '../services/pitchRange';
import '../../styles/PitchPanel.css';
import { encodePitchWav, separatePitch } from '../services/pitchSeparation';

type Track = { hop: number; hz: number[]; duration: number; loadSeconds: number; analysisSeconds: number; cached: boolean; separationSeconds?: number; stems?: Record<string, string> };
type Props = { sourceKey: string; getAudio: () => Promise<ArrayBuffer>; currentTime: number; unavailable?: string; mode?: 'original' | 'separated' };
const memory = new Map<string, Track>();
const note = (hz: number) => {
  if (!hz) return '—';
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
};

export function PitchComparison(props: Props) {
  return <div className="pitch-comparison"><PitchPanel {...props} /><PitchPanel {...props} mode="separated" /></div>;
}

export function PitchPanel({ sourceKey, getAudio, currentTime, unavailable, mode = 'original' }: Props) {
  const cacheKey = `${mode}:${sourceKey}`;
  const separated = mode === 'separated';
  const [track, setTrack] = useState<Track | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const chart = useRef<SVGSVGElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 800, height: 240 });
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setChartSize({ width, height });
    });
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    generation.current++; controller.current?.abort(); setBusy(false); setStatus(''); setTrack(memory.get(cacheKey) || null);
    return () => { generation.current++; controller.current?.abort(); };
  }, [cacheKey]);
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
      const rate = separated ? 44100 : 16000;
      const renderer = new OfflineAudioContext(separated ? Math.min(2, buffer.numberOfChannels) : 1, Math.ceil(buffer.duration * rate), rate);
      const source = renderer.createBufferSource(); source.buffer = buffer; source.connect(renderer.destination); source.start();
      const rendered = await renderer.startRendering();
      const pcm = rendered.getChannelData(0);
      if (id !== generation.current) return;
      setStatus('RMVPE 正在分析，首次使用需要加载模型；歌曲可继续播放…');
      let result: Track;
      if (separated) {
        const wav = encodePitchWav(Array.from({ length: rendered.numberOfChannels }, (_, channel) => rendered.getChannelData(channel)), rate);
        result = await separatePitch(wav, abort.signal, text => { if (id === generation.current) setStatus(text); });
      } else {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000'}/api/pitch`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: pcm.slice().buffer, signal: abort.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '分析失败');
        result = body;
      }
      if (!Array.isArray(result.hz) || result.hop !== .01) throw new Error('音高数据无效');
      if (id === generation.current) { memory.set(cacheKey, result); while (memory.size > 10) memory.delete(memory.keys().next().value!); setTrack(result); setStatus(''); }
    } catch (error) { if (id === generation.current) setStatus(error instanceof Error ? error.message : '分析失败，请重试'); }
    finally { await context?.close(); if (id === generation.current) setBusy(false); }
  };
  const hz = track?.hz[Math.floor(currentTime / track.hop)] || 0;
  const midi = hz ? 69 + 12 * Math.log2(hz / 440) : 0;
  const start = Math.max(0, currentTime - 10);
  const { low, high } = useMemo(() => pitchRange(track?.hz || []), [track]);
  const tickStep = high - low > 36 ? 12 : 6;
  const ticks = Array.from({ length: Math.floor((high - low) / tickStep) + 1 }, (_, index) => low + index * tickStep);
  const plotWidth = Math.max(1, chartSize.width - 58);
  const plotHeight = Math.max(1, chartSize.height - 40);
  const paths: string[] = [];
  let path = '';
  if (track) for (let i = Math.floor(start / track.hop); i < Math.min(track.hz.length, Math.ceil((start + 15) / track.hop)); i += 3) {
    const f = track.hz[i];
    if (!f) { if (path) paths.push(path); path = ''; continue; }
    const m = 69 + 12 * Math.log2(f / 440);
    if (m < low || m > high) { if (path) paths.push(path); path = ''; continue; }
    path += `${path ? 'L' : 'M'}${48 + (i * track.hop - start) / 15 * plotWidth},${12 + (high - m) / (high - low) * plotHeight} `;
  }
  if (path) paths.push(path);
  const message = unavailable || status || (track ? `${track.cached ? '已读取缓存' : '分析完成'}${track.separationSeconds !== undefined ? ` · 分离 ${track.separationSeconds.toFixed(1)} 秒` : ''} · 模型加载 ${track.loadSeconds.toFixed(1)} 秒 · 推理 ${track.analysisSeconds.toFixed(1)} 秒` : separated ? '先分离伴奏与人声，再分离主唱与和声；CPU 分离可能需要数分钟。' : '点击分析后随播放显示音名和曲线；无人声时曲线留空。');
  return <section className="pitch-panel" aria-label={separated ? '主唱分离后音高分析' : '原曲人声音高分析'}>
    <div className="pitch-heading">
      <span className="pitch-title">{separated ? '主唱分离后音高' : '人声音高'} <small>{separated ? 'RoFormer → Karaoke 2 → RMVPE' : 'RMVPE · 原曲'}</small></span>
      <div className="pitch-reading"><strong>{note(hz)}</strong><span>{hz ? `${hz.toFixed(1)} Hz · ${Math.round((midi - Math.round(midi)) * 100)} 音分` : '等待人声音高'}</span></div>
      <p className="pitch-status" role="status">{message}</p>
      <button className="pitch-analyze-button" onClick={analyze} disabled={busy || !!unavailable || !sourceKey} aria-busy={busy} data-disabled-reason={busy ? '正在分析' : unavailable || '请先选择歌曲'}>{busy ? '正在分析' : track ? '重新分析' : '分析音高'}</button>
    </div>
    <svg ref={chart} viewBox={`0 0 ${chartSize.width} ${chartSize.height}`} role="img" aria-label="最近十五秒的人声音高曲线，横轴时间，纵轴音名">
      {ticks.map(m => { const y = 12 + (high - m) / (high - low) * plotHeight; return <g key={m}><text x="0" y={y + 4}>{note(440 * 2 ** ((m - 69) / 12))}</text><line x1="45" x2={chartSize.width - 10} y1={y} y2={y} className="pitch-grid" /></g>; })}
      {paths.map((d, i) => <path key={i} d={d} className="pitch-curve" />)}
      {track && <line x1={48 + (currentTime - start) / 15 * plotWidth} x2={48 + (currentTime - start) / 15 * plotWidth} y1="10" y2={12 + plotHeight} className="pitch-cursor" />}
      {[0, 5, 10, 15].map(t => <text key={t} textAnchor={t === 15 ? "end" : t === 0 ? "start" : "middle"} x={48 + t / 15 * plotWidth} y={chartSize.height - 5}>{Math.floor(start + t)}s</text>)}
    </svg>
    {separated && track?.stems && <div className="pitch-stems"><p>暂停原曲后可分别试听分离效果</p>{[['lead', '主唱'], ['backing', '和声'], ['instrumental', '伴奏']].map(([stem, label]) => <label key={stem}>{label}<audio controls preload="none" src={track.stems?.[stem]} aria-label={`${label}分离试听`} onPlay={event => { const selected = event.currentTarget; selected.closest('.pitch-stems')?.querySelectorAll('audio').forEach(audio => { if (audio !== selected) audio.pause(); }); }} /></label>)}</div>}
  </section>;
}

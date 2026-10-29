import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { processPcm } from '../services/audioProcessing';
import '../../styles/AudioTrimDialog.css';
import { lyricCues, parseLrc, type LyricLine } from '../services/lyrics';

interface Props {
  buffer: AudioBuffer;
  selection: [number, number] | null;
  tempo: number;
  pitch: number;
  volume: number;
  lyrics: LyricLine[];
  onClose: () => void;
  onApply: (selection: [number, number]) => void;
}

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

export function AudioTrimDialog({ buffer, selection, tempo, pitch, volume, lyrics, onClose, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number]>(selection || [0, buffer.duration]);
  const [cursor, setCursor] = useState(selection?.[0] || 0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localLyrics, setLocalLyrics] = useState<LyricLine[] | null>(null);
  const [lyricAnchor, setLyricAnchor] = useState<number | null>(null);
  const cues = useMemo(() => lyricCues(localLyrics ?? lyrics, buffer.duration), [localLyrics, lyrics, buffer.duration]);
  const currentCue = cues.find(cue => cursor >= cue.time && cursor < cue.end);
  const engine = useRef<{ context: AudioContext; source?: AudioBufferSourceNode; frame?: number } | null>(null);
  const generation = useRef(0);
  const clipId = useId().replace(/:/g, '');
  const waveform = useMemo(() => {
    const pcm = buffer.getChannelData(0);
    const peaks = Array.from({ length: 640 }, (_, i) => {
      const first = Math.floor(i * pcm.length / 640), last = Math.floor((i + 1) * pcm.length / 640);
      let peak = 0;
      for (let j = first; j < last; j++) peak = Math.max(peak, Math.abs(pcm[j]));
      return peak;
    });
    const max = Math.max(0.01, ...peaks);
    return peaks.map((peak, i) => `M${i + 0.5},${80 - peak / max * 66}V${80 + peak / max * 66}`).join(' ');
  }, [buffer]);
  const stop = () => {
    generation.current++;
    const active = engine.current;
    if (active) {
      if (active.frame) cancelAnimationFrame(active.frame);
      if (active.source) { active.source.onended = null; active.source.stop(); }
      void active.context.close();
      engine.current = null;
    }
    setPlaying(false); setLoading(false);
  };
  useEffect(() => {
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { stop(); document.body.style.overflow = previousOverflow; };
  }, []);
  const updateRange = (next: [number, number]) => { stop(); setRange(next); setCursor(next[0]); };
  const pointerTime = (x: number) => {
    const rect = timeline.current!.getBoundingClientRect();
    return Math.max(0, Math.min(buffer.duration, (x - rect.left) / rect.width * buffer.duration));
  };
  const moveBoundary = (side: 0 | 1, value: number) => {
    const gap = Math.min(0.05, buffer.duration);
    updateRange(side === 0 ? [Math.max(0, Math.min(value, range[1] - gap)), range[1]] : [range[0], Math.min(buffer.duration, Math.max(value, range[0] + gap))]);
  };
  const play = async () => {
    if (playing || loading) { stop(); return; }
    stop();
    const id = generation.current;
    const from = cursor >= range[0] && cursor < range[1] - 0.02 ? cursor : range[0];
    setLoading(true); setError('');
    const context = new AudioContext({ sampleRate: buffer.sampleRate });
    engine.current = { context };
    try {
      await context.resume();
      const pcm = await processPcm(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c)), buffer.sampleRate, from, range[1], tempo, pitch, () => id !== generation.current);
      if (id !== generation.current) return;
      const result = context.createBuffer(pcm.length, pcm[0].length, buffer.sampleRate);
      pcm.forEach((channel, c) => result.getChannelData(c).set(channel));
      const source = context.createBufferSource();
      const gain = context.createGain(); gain.gain.value = volume / 100;
      source.buffer = result; source.connect(gain); gain.connect(context.destination);
      engine.current!.source = source;
      const began = context.currentTime;
      const tick = () => {
        if (id !== generation.current) return;
        setCursor(Math.min(range[1], from + (context.currentTime - began) * tempo));
        engine.current!.frame = requestAnimationFrame(tick);
      };
      source.onended = () => { stop(); setCursor(range[0]); };
      source.start(); setPlaying(true); setLoading(false); tick();
    } catch (reason) { if (id === generation.current) { stop(); setError(reason instanceof Error ? reason.message : '试听失败'); } }
  };
  const left = range[0] / buffer.duration * 100, right = range[1] / buffer.duration * 100;
  return <dialog ref={dialog} className="audio-trim-dialog" aria-labelledby="trim-title" onCancel={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <div className="trim-dialog-body">
      <header><div><h2 id="trim-title">修剪音频</h2><p>拖动两侧边界，选择要保留的片段</p></div><button className="trim-icon-button" onClick={onClose} aria-label="关闭修剪"><X size={20} /></button></header>
      <div className="trim-timeline" ref={timeline} onClick={e => { stop(); setCursor(Math.max(range[0], Math.min(range[1], pointerTime(e.clientX)))); }}>
        <svg viewBox="0 0 640 160" preserveAspectRatio="none" aria-label="原始音频波形">
          <defs><clipPath id={clipId}><rect x={left * 6.4} y="0" width={(right - left) * 6.4} height="160" /></clipPath></defs>
          <path d={waveform} stroke="#465064" strokeWidth="0.65" />
          <path d={waveform} stroke="#a7b4ff" strokeWidth="0.65" clipPath={`url(#${clipId})`} />
        </svg>
        <div className="trim-selected-region" style={{ left: `${left}%`, width: `${right - left}%` }} />
        <div className="trim-playhead" style={{ left: `${cursor / buffer.duration * 100}%` }} />
        {([0, 1] as const).map(side => <button key={side} className={`trim-boundary trim-boundary-${side}`} style={{ left: `${side === 0 ? left : right}%` }} role="slider" aria-label={side === 0 ? '裁剪起点' : '裁剪终点'} aria-valuemin={0} aria-valuemax={buffer.duration} aria-valuenow={range[side]} aria-valuetext={time(range[side])}
          onClick={e => e.stopPropagation()} onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); stop(); }}
          onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) moveBoundary(side, pointerTime(e.clientX)); }}
          onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); moveBoundary(side, range[side] + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 0.1)); } }}><span /></button>)}
      </div>
      <div className="trim-ruler"><span>0:00</span><span>{time(buffer.duration / 2)}</span><span>{time(buffer.duration)}</span></div>
      <p className="trim-current-lyric" aria-live="polite">{currentCue?.text || (cues.length ? '点击波形定位，或试听选区' : '当前素材暂无同步歌词')}</p>
      <div className="trim-selection-details"><div><label htmlFor="trim-start">开始（秒）</label><input id="trim-start" aria-label="裁剪开始秒数" type="number" step="0.01" min="0" max={range[1]} value={Number(range[0].toFixed(3))} onChange={e => { if (e.target.value) moveBoundary(0, Number(e.target.value)); }} /></div><div><label htmlFor="trim-end">结束（秒）</label><input id="trim-end" aria-label="裁剪结束秒数" type="number" step="0.01" min={range[0]} max={buffer.duration} value={Number(range[1].toFixed(3))} onChange={e => { if (e.target.value) moveBoundary(1, Number(e.target.value)); }} /></div><div><span>选中时长</span><strong>{time(range[1] - range[0])}</strong></div></div>
      <section className="trim-lyrics-section">
        <div className="trim-lyrics-heading"><h3>按歌词选句</h3><label className="trim-load-lrc">导入 LRC<input type="file" accept=".lrc,text/plain" aria-label="导入同步歌词" onChange={async e => { const file = e.target.files?.[0]; if (file) { const lines = parseLrc(await file.text()); setLocalLyrics(lines); setLyricAnchor(null); if (!lines.length) setError('此文件没有可用的歌词时间戳'); } }} /></label></div>
        {cues.length > 0 ? <><p>点击选一句，Shift + 点击选择连续多句</p><div className="trim-lyric-list">{cues.map((cue, index) => <button key={`${cue.time}-${index}`} type="button" className={currentCue === cue ? 'is-current' : ''} aria-pressed={cue.time >= range[0] - 0.001 && cue.end <= range[1] + 0.001} onClick={e => {
          const first = e.shiftKey && lyricAnchor !== null ? Math.min(lyricAnchor, index) : index;
          const last = e.shiftKey && lyricAnchor !== null ? Math.max(lyricAnchor, index) : index;
          if (!e.shiftKey || lyricAnchor === null) setLyricAnchor(index);
          updateRange([cues[first].time, Math.min(buffer.duration, cues[last].end)]);
        }}><time>{time(cue.time)}</time><span>{cue.text}</span></button>)}</div></> : <p>从歌曲导入素材可自动读取歌词；本地音频可导入对应的 LRC 文件。</p>}
      </section>
      {error && <p role="alert">{error}</p>}
      <footer><button className="trim-preview-button" onClick={play}>{playing ? <Pause size={16} /> : <Play size={16} />}{loading ? '停止处理' : playing ? '暂停试听' : '试听选区'}</button><div><button className="trim-secondary-button" onClick={onClose}>取消</button><button className="trim-primary-button" onClick={() => { stop(); onApply(range); }}>保留选区</button></div></footer>
    </div>
  </dialog>;
}

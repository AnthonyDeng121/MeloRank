export function encodePitchWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const length = channels[0].length;
  const output = new ArrayBuffer(44 + length * channels.length * 2);
  const view = new DataView(output);
  const word = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  word(0, 'RIFF'); view.setUint32(4, output.byteLength - 8, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, output.byteLength - 44, true);
  for (let i = 0; i < length; i++) for (let c = 0; c < channels.length; c++) {
    const sample = Math.max(-1, Math.min(1, channels[c][i]));
    view.setInt16(44 + (i * channels.length + c) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return output;
}

const phases: Record<string, string> = {
  starting: '正在启动分离环境', 'loading-vocals': '正在加载人声模型，首次使用需要下载',
  'separating-vocals': '正在分离伴奏与全部人声', 'loading-lead': '正在加载主唱／和声模型',
  'separating-lead': '正在分离主唱与和声', 'loading-pitch': '正在加载 RMVPE', 'analyzing-pitch': '正在计算主唱音高',
};
export async function separatePitch(wav: ArrayBuffer, signal: AbortSignal, progress: (text: string) => void) {
  const backend = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
  const response = await fetch(`${backend}/api/pitch/separation`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav, signal });
  let job = await response.json();
  if (!response.ok) throw new Error(job.error || '主唱分离启动失败');
  const id = job.id;
  const started = Date.now();
  while (job.status === 'running') {
    progress(`${phases[job.phase] || '正在分析'} · 已用 ${Math.floor((Date.now() - started) / 1000)} 秒`);
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new DOMException('已取消等待', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, 1500);
      if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true });
    });
    const check = await fetch(`${backend}/api/pitch/separation/jobs/${id}`, { signal });
    job = await check.json();
    if (!check.ok) throw new Error(job.error || '无法读取分离进度');
  }
  if (job.status !== 'done') throw new Error(job.error || '分离失败，请重试');
  return { ...job.result, stems: Object.fromEntries(Object.entries(job.result.stems || {}).map(([name, url]) => [name, `${backend}${url}`])) };
}

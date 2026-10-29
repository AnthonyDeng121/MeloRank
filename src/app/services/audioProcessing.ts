import { SoundTouch, SimpleFilter } from 'soundtouchjs';

// Always read original PCM; padding flushes SoundTouch's internal processing tail.
export async function processPcm(
  channels: Float32Array[], sampleRate: number, start: number, end: number,
  tempo: number, semitones: number, cancelled: () => boolean = () => false,
): Promise<Float32Array[]> {
  const first = Math.floor(start * sampleRate);
  const count = Math.min(channels[0].length, Math.floor(end * sampleRate)) - first;
  if (first < 0 || count <= 0 || !Number.isFinite(count) || tempo <= 0) throw new Error('请选择有效的裁剪范围');
  if (tempo === 1 && semitones === 0) return channels.map(c => c.slice(first, first + count));
  const pipe = new SoundTouch();
  // Offline rendering favours accurate overlap matching over the coarse quick
  // search. Shorter grains reduce repeated transients when pitching upward;
  // a longer crossfade softens joins between grains.
  pipe.stretch.setParameters(sampleRate, 60, 20, 16);
  pipe.stretch.quickSeek = false;
  pipe.tempo = tempo;
  pipe.pitchSemitones = semitones;
  const filter = new SimpleFilter({
    extract(target, frames, position) {
      for (let i = 0; i < frames; i++) {
        const p = position + i;
        target[2 * i] = p < count ? channels[0][first + p] : 0;
        target[2 * i + 1] = p < count ? (channels[1] || channels[0])[first + p] : 0;
      }
      return frames;
    },
  }, pipe);
  const length = Math.ceil(count / tempo);
  const output = Array.from({ length: Math.min(2, channels.length) }, () => new Float32Array(length));
  const block = new Float32Array(8192);
  for (let position = 0; position < length;) {
    if (cancelled()) throw new Error('处理已取消');
    const size = filter.extract(block, Math.min(4096, length - position));
    if (!size) throw new Error('音频处理提前结束');
    for (let c = 0; c < output.length; c++) for (let i = 0; i < size; i++) output[c][position + i] = block[i * 2 + c];
    position += size;
    if (position % 65536 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return output;
}

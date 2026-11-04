import { Mp3Encoder } from '@breezystack/lamejs';

self.onmessage = ({ data }: MessageEvent<{ channels: Float32Array[]; sampleRate: number }>) => {
  try {
    const channels = data.channels.map(channel => Int16Array.from(channel, sample => {
      const value = Math.max(-1, Math.min(1, sample));
      return Math.round(value * (value < 0 ? 32768 : 32767));
    }));
    const encoder = new Mp3Encoder(channels.length, data.sampleRate, 192);
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < channels[0].length; offset += 1152) {
      const chunk = encoder.encodeBuffer(channels[0].subarray(offset, offset + 1152), channels[1]?.subarray(offset, offset + 1152));
      if (chunk.length) chunks.push(new Uint8Array(chunk));
    }
    const tail = encoder.flush();
    if (tail.length) chunks.push(new Uint8Array(tail));
    self.postMessage({ chunks });
  } catch {
    self.postMessage({ error: 'MP3 编码失败，请重试或选择 WAV' });
  }
};

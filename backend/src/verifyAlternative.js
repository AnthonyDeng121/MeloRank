const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);

async function verifyAlternative(url, expectedDuration) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok || !response.body) throw new Error('替代音源读取失败');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 32 * 1024 * 1024) throw new Error('替代音源超过校验大小限制');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'melorank-audio-check-'));
  const file = path.join(directory, 'audio');
  try {
    await fs.writeFile(file, Buffer.concat(chunks));
    const { stdout } = await execFile(process.env.MELORANK_FFPROBE || 'ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'format=duration:stream=codec_name,sample_rate,nb_read_frames', '-of', 'json', file], { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 });
    const info = JSON.parse(stdout);
    const stream = info.streams?.[0];
    let duration = Number(info.format?.duration);
    if (stream?.codec_name === 'mp3' && Number(stream.nb_read_frames) > 0) duration = Number(stream.nb_read_frames) * (Number(stream.sample_rate) > 24000 ? 1152 : 576) / Number(stream.sample_rate);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('无法验证替代音源时长');
    const expected = Number(expectedDuration);
    if (expected > 0 ? duration < expected * 0.75 || duration > expected * 1.25 : duration < 30) throw new Error(`替代音源实际仅 ${duration.toFixed(1)} 秒或版本时长不符，已拦截`);
    return duration;
  } finally { await fs.unlink(file).catch(() => {}); await fs.rmdir(directory).catch(() => {}); }
}
module.exports = { verifyAlternative };

const express = require('express');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const directory = process.env.MELORANK_PITCH_DATA || path.join(os.homedir(), '.melorank-pitch');
let active = false;
const router = express.Router();
router.post('/', express.raw({ type: 'application/octet-stream', limit: '40mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length < 640 || req.body.length % 4) return res.status(400).json({ error: '请上传单声道 16kHz PCM 音频' });
  const key = createHash('sha256').update('rmvpe-v1:').update(req.body).digest('hex');
  const cache = path.join(directory, `${key}.json`);
  let ownsJob = false;
  try {
    try { return res.json({ ...JSON.parse(await fs.readFile(cache, 'utf8')), cached: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (active) return res.status(429).json({ error: '已有音高分析任务，请稍后重试' });
    active = true;
    ownsJob = true;
    await fs.mkdir(directory, { recursive: true });
    const input = path.join(directory, `${key}.pcm`);
    await fs.writeFile(input, req.body);
    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.env.MELORANK_PYTHON || 'python', [path.join(__dirname, '../pitch/analyze.py'), input], { windowsHide: true });
        let stdout = ''; let stderr = '';
        const timer = setTimeout(() => { child.kill(); reject(new Error('音高分析超时，请缩短音频后重试')); }, 15 * 60 * 1000);
        child.stdout.on('data', data => { stdout += data; });
        child.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
        child.on('error', error => { clearTimeout(timer); reject(error); });
        child.on('close', code => { clearTimeout(timer); if (code) reject(new Error(stderr || 'RMVPE 分析失败')); else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } } });
      });
      await fs.writeFile(cache + '.tmp', JSON.stringify(result));
      await fs.rename(cache + '.tmp', cache);
      res.json({ ...result, cached: false });
    } finally { await fs.unlink(input).catch(() => {}); }
  } catch (error) {
    console.error('RMVPE:', error.message);
    res.status(503).json({ error: 'RMVPE 暂不可用，请检查模型和 Python 依赖，或稍后重试' });
  } finally { if (ownsJob) active = false; }
});
module.exports = router;

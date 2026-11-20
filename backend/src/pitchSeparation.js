const express = require('express');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const root = process.env.MELORANK_PITCH_DATA || path.join(os.homedir(), '.melorank-pitch');
const python = process.env.MELORANK_SEPARATOR_PYTHON || path.join(root, 'separator-venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const jobs = new Map();
let active = false;
const router = express.Router();
const valid = key => /^[a-f0-9]{64}$/.test(key);
const jobDir = key => path.join(root, 'separated', key);
const enrich = (result, key, cached) => ({ ...result, cached, stems: Object.fromEntries(['lead', 'backing', 'instrumental'].map(stem => [stem, `/api/pitch/separation/stems/${key}/${stem}`])) });

router.post('/', express.raw({ type: 'audio/wav', limit: '110mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length < 44 || req.body.toString('ascii', 0, 4) !== 'RIFF' || req.body.toString('ascii', 8, 12) !== 'WAVE') return res.status(400).json({ error: '请提供 WAV 音频' });
  const key = createHash('sha256').update('separation-v1:bs317-kara2-rmvpe:').update(req.body).digest('hex');
  const directory = jobDir(key);
  let ownsJob = false;
  try {
    try { const result = JSON.parse(await fs.readFile(path.join(directory, 'result.json'), 'utf8')); return res.json({ status: 'done', result: enrich(result, key, true) }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (jobs.get(key)?.status === 'running') return res.status(202).json({ id: key, ...jobs.get(key) });
    if (active) return res.status(429).json({ error: '已有主唱分离任务，请稍后重试' });
    active = true; ownsJob = true;
    await fs.access(python);
    await fs.mkdir(directory, { recursive: true });
    const input = path.join(directory, 'input.wav');
    await fs.writeFile(input, req.body);
    for (const [id, job] of jobs) if (jobs.size >= 20 && job.status !== 'running') jobs.delete(id);
    jobs.set(key, { status: 'running', phase: 'starting', progress: 0 });
    const child = spawn(python, ['-u', path.join(__dirname, '../pitch/separate.py'), input, directory], { windowsHide: true, env: { ...process.env, OMP_NUM_THREADS: '2', MKL_NUM_THREADS: '2', PYTHONIOENCODING: 'utf-8' } });
    let pending = ''; let diagnostic = ''; let result; let settled = false;
    const finish = async error => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      try {
        if (error || !result) throw error || new Error('未生成音高结果');
        for (const stem of ['lead', 'backing', 'instrumental']) await fs.access(path.join(directory, `${stem}.wav`));
        await fs.writeFile(path.join(directory, 'result.tmp'), JSON.stringify(result));
        await fs.rename(path.join(directory, 'result.tmp'), path.join(directory, 'result.json'));
        jobs.set(key, { status: 'done', result: enrich(result, key, false) });
      } catch (failure) {
        console.error('主唱分离失败:', failure.message, diagnostic);
        jobs.set(key, { status: 'error', error: '主唱分离失败，请检查模型下载、Python 依赖或重试' });
      } finally {
        await fs.unlink(input).catch(() => {});
        await fs.unlink(path.join(directory, 'all-vocals.wav')).catch(() => {});
        active = false;
      }
    };
    const timer = setTimeout(() => { child.kill(); void finish(new Error('任务超过一小时')); }, 60 * 60 * 1000);
    child.stdout.on('data', data => {
      pending += data;
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) {
        try { const event = JSON.parse(line); if (event.result) result = event.result; else if (typeof event.phase === 'string') jobs.set(key, { status: 'running', phase: event.phase, progress: event.progress }); } catch { /* library output is not a progress event */ }
      }
    });
    child.stderr.on('data', data => { diagnostic = (diagnostic + data).slice(-6000); });
    child.on('error', error => { void finish(error); });
    child.on('close', code => { void finish(code ? new Error(`进程退出 ${code}`) : null); });
    res.status(202).json({ id: key, status: 'running', phase: 'starting', progress: 0 });
  } catch (error) {
    if (ownsJob) active = false;
    console.error('主唱分离启动失败:', error.message);
    res.status(503).json({ error: '分离环境尚未就绪，请先安装 requirements-separator.txt 并准备模型' });
  }
});
router.get('/jobs/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!valid(req.params.id)) return res.status(400).json({ error: '无效任务' });
  const job = jobs.get(req.params.id);
  if (job) return res.json(job);
  try { const result = JSON.parse(await fs.readFile(path.join(jobDir(req.params.id), 'result.json'), 'utf8')); return res.json({ status: 'done', result: enrich(result, req.params.id, true) }); } catch { return res.status(404).json({ error: '任务不存在，请重新分析' }); }
});
router.get('/stems/:id/:stem', (req, res) => {
  if (!valid(req.params.id) || !['lead', 'backing', 'instrumental'].includes(req.params.stem)) return res.sendStatus(404);
  res.sendFile(path.join(jobDir(req.params.id), `${req.params.stem}.wav`));
});
module.exports = router;

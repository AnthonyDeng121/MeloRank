// Exercise the real HTTP router while replacing only the expensive model process.
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'melorank-separation-check-'));
  const source = path.resolve(__dirname, '../backend/src/pitchSeparation.js');
  const localRequire = createRequire(source);
  const express = localRequire('express');
  const children = [];
  const module = { exports: {} };
  const python = path.join(directory, 'python');
  await fs.writeFile(python, 'fixture');
  const injectedRequire = name => name === 'node:child_process' ? { spawn: (_exe, args) => {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.kill = () => {};
    children.push({ child, args }); return child;
  } } : localRequire(name);
  vm.runInNewContext(await fs.readFile(source, 'utf8'), { require: injectedRequire, module, __dirname: path.dirname(source), process: { platform: process.platform, env: { ...process.env, MELORANK_PITCH_DATA: directory, MELORANK_SEPARATOR_PYTHON: python } }, console, Buffer, setTimeout, clearTimeout });
  const app = express(); app.use('/api/pitch/separation', module.exports);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/pitch/separation`;
  const wav = Buffer.alloc(48); wav.write('RIFF'); wav.write('WAVE', 8);
  const post = body => fetch(base, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body });
  try {
    assert.equal((await post(Buffer.from('invalid'))).status, 400);
    const start = await post(wav); assert.equal(start.status, 202); const { id } = await start.json();
    assert.equal(children.length, 1);
    assert.equal((await post(wav)).status, 202); assert.equal(children.length, 1, 'duplicate must reuse job');
    const other = Buffer.from(wav); other[47] = 1;
    assert.equal((await post(other)).status, 429);
    const { child, args } = children[0];
    child.stdout.emit('data', Buffer.from('{"phase":"separating-lead","progress":60}\n'));
    assert.equal((await (await fetch(`${base}/jobs/${id}`)).json()).phase, 'separating-lead');
    for (const stem of ['lead', 'backing', 'instrumental']) await fs.writeFile(path.join(args[3], `${stem}.wav`), wav);
    child.stdout.emit('data', Buffer.from(JSON.stringify({ result: { hop: .01, hz: [440], loadSeconds: 1, analysisSeconds: 1, separationSeconds: 2 } }) + '\n'));
    child.emit('close', 0);
    let completed;
    for (let attempt = 0; attempt < 100; attempt++) {
      completed = await (await fetch(`${base}/jobs/${id}`)).json();
      if (completed.status === 'done') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(completed.status, 'done');
    assert.equal((await (await post(wav)).json()).result.cached, true);
    assert.equal(children.length, 1);
    assert.equal((await fetch(`${base}/stems/${id}/lead`)).status, 200);
    assert.equal((await fetch(`${base}/stems/${id}/unknown`)).status, 404);
    await assert.rejects(fs.access(args[2]), 'uploaded source must be removed');
    const retryStart = await post(other); assert.equal(retryStart.status, 202);
    const failedId = (await retryStart.json()).id;
    children[1].child.stderr.emit('data', Buffer.from('fixture model error'));
    children[1].child.emit('close', 1);
    let failed;
    for (let attempt = 0; attempt < 100; attempt++) {
      failed = await (await fetch(`${base}/jobs/${failedId}`)).json();
      if (failed.status === 'error') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(failed.status, 'error');
    await assert.rejects(fs.access(children[1].args[2]));
    assert.equal((await fetch(`${base}/jobs/not-a-hash`)).status, 400);
    console.log('PASS: validation, deduplication, concurrency, progress, cache, stems and source cleanup');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

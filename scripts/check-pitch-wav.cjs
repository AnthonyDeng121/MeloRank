const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/services/pitchSeparation.ts'), 'utf8').replaceAll('import.meta.env.VITE_BACKEND_API_URL', "'http://fixture'");
  const exports = {};
  const replies = [
    { id: 'fixture', status: 'running', phase: 'separating-vocals' },
    { status: 'done', result: { hop: .01, hz: [440], stems: { lead: '/lead.wav' } } },
  ];
  const calls = [];
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, setTimeout, clearTimeout, DOMException, fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => replies.shift() }; } });
  const wav = exports.encodePitchWav([Float32Array.from([-1, .5, 2]), Float32Array.from([1, -.5, -2])], 44100);
  const bytes = Buffer.from(wav); const view = new DataView(wav);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(40, true), 12);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true)), [-32768, 32767, 16384, -16384, 32767, -32768]);
  const phases = [];
  const result = await exports.separatePitch(wav, new AbortController().signal, text => phases.push(text));
  assert.equal(calls[0].options.headers['Content-Type'], 'audio/wav');
  assert.equal(calls[1].url, 'http://fixture/api/pitch/separation/jobs/fixture');
  assert.equal(result.stems.lead, 'http://fixture/lead.wav');
  assert.equal(phases.length, 1);
  replies.push({ id: 'fixture', status: 'running' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(exports.separatePitch(wav, controller.signal, () => {}), error => error.name === 'AbortError');
  console.log('PASS: stereo WAV, clipping, interleaving, task polling, stem URLs and cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
import { Mp3Encoder } from '@breezystack/lamejs';

// Exercise the actual worker, including clipping, the final partial block and flush.
const source = fs.readFileSync(new URL('../src/app/services/mp3Encoder.worker.ts', import.meta.url), 'utf8');
const code = ts.transpile(source.replace(/^import .*;\r?\n/, ''), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None });
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'melorank-mp3-'));
try {
  for (const count of [1, 2]) {
    let result;
    const self = { postMessage: value => { result = value; } };
    vm.runInNewContext(code, { self, Mp3Encoder, Int16Array, Uint8Array });
    const channels = Array.from({ length: count }, (_, c) => Float32Array.from({ length: 44100 + 137 }, (_, i) => Math.sin(2 * Math.PI * (440 + c * 220) * i / 44100) * .6));
    self.onmessage({ data: { channels, sampleRate: 44100 } });
    assert.ok(!result.error, result.error);
    const encoded = Buffer.concat(result.chunks);
    assert.ok(encoded.length < channels[0].length * count * 2);
    const file = path.join(directory, `${count}.mp3`);
    fs.writeFileSync(file, encoded);
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', file], { encoding: 'utf8' });
    assert.equal(probe.status, 0, probe.stderr || 'ffprobe is required for this verification');
    const stream = JSON.parse(probe.stdout).streams[0];
    assert.equal(stream.codec_name, 'mp3');
    assert.equal(stream.channels, count);
    assert.equal(stream.sample_rate, '44100');
    assert.ok(Math.abs(Number(stream.duration) - channels[0].length / 44100) < .1);
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
    assert.equal(decoded.status, 0, decoded.stderr);
  }
  console.log('PASS actual MP3 worker: mono/stereo, size, codec, sample rate, duration and full decode');
} finally { fs.rmSync(directory, { recursive: true, force: true }); }

const fs = require('node:fs');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');

(async () => {
  const source = ts.transpileModule(fs.readFileSync('src/app/services/audioProcessing.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace("'soundtouchjs'", JSON.stringify(pathToFileURL(require.resolve('soundtouchjs')).href));
  const { processPcm } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  for (const sampleRate of [44100, 48000]) {
    const input = Float32Array.from({ length: sampleRate * 4 }, (_, i) => Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5);
    for (const [tempo, pitch, expected] of [[1, 12, 880], [1.5, 0, 440], [0.75, -12, 220], [1.5, 7, 440 * 2 ** (7 / 12)], [0.25, 0, 440], [2, 12, 880]]) {
      const [output] = await processPcm([input], sampleRate, 0.5, 3.5, tempo, pitch);
      assert.equal(output.length, Math.ceil(sampleRate * 3 / tempo));
      const first = Math.floor(output.length * 0.2), last = Math.floor(output.length * 0.8);
      let crossings = 0;
      for (let i = first + 1; i < last; i++) if (output[i - 1] <= 0 && output[i] > 0) crossings++;
      const frequency = crossings * sampleRate / (last - first);
      assert.ok(Math.abs(frequency - expected) < 5, `${sampleRate}: expected ${expected}Hz, got ${frequency}Hz`);
    }
  }
  console.log('PASS independent pitch/tempo, combined trim, exact duration at 44.1/48kHz');
})().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
async function run(mode) {
  let handler, carCalls = 0;
  const sandbox = { module: { exports: {} }, setTimeout, clearTimeout, AbortSignal,
    require(name) {
      if (name === './alternativeAudio') return { registerAudio: () => '/api/music/alternative-audio/test' };
      if (name === 'express') return { Router: () => ({ post: (_, fn) => { handler = fn; } }) };
      if (name === './verifyAlternative') return { verifyAlternative: async () => { if (mode === 'short') throw new Error('short clip'); return 211; } };
      if (name === './kuwoCarPlayback') return { kuwoCarPlayback: async () => { carCalls++; return { url: 'https://audio.test/full', source: 'kuwo-car', verifiedDuration: 211 }; } };
      return async (_, sources) => { if (mode === 'error') throw new Error('unavailable'); return { url: 'https://audio.test/old', source: sources[0] }; };
    },
  };
  vm.runInNewContext(fs.readFileSync('backend/src/unblockPlayback.js', 'utf8'), sandbox);
  let result;
  const res = { set() {}, json(value) { result = value; }, status() { return this; } };
  await handler({ body: { title: 'Song', artists: ['Artist'], duration: 211 } }, res);
  assert.equal(carCalls, mode === 'full' ? 0 : 1);
  assert.equal(result.source, mode === 'full' ? 'kugou' : 'kuwo-car');
}
Promise.all(['full', 'short', 'error'].map(run)).then(() => console.log('PASS old full source preserved; short clips and provider errors reach car fallback')).catch(error => { console.error(error); process.exitCode = 1; });

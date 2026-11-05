const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let instance, calls = [], disconnected = 0;
class Player {
  constructor(options) { this.options = options; this.listeners = {}; instance = this; }
  addListener(name, callback) { this.listeners[name] = callback; }
  async connect() { queueMicrotask(() => this.listeners.ready({ device_id: 'fixture-device' })); return true; }
  activateElement() { return Promise.resolve(); }
  pause() { calls.push('pause'); return Promise.resolve(); }
  resume() { calls.push('resume'); return Promise.resolve(); }
  seek(value) { calls.push(['seek', value]); return Promise.resolve(); }
  setVolume(value) { calls.push(['volume', value]); return Promise.resolve(); }
  disconnect() { disconnected++; }
  getCurrentState() { return Promise.resolve(null); }
}
const sandbox = { exports: {}, window: { Spotify: { Player } }, require: () => ({ spotify: { token: async () => 'fixture-token' } }), AbortSignal, DOMException, setTimeout, clearTimeout,
  fetch: async (url, options) => { calls.push({ url, options }); return { ok: true }; } };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/services/spotifyPlayback.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
const player = sandbox.exports.spotifyPlayback;
(async () => {
  await player.play('spotify:track:fixture', new AbortController().signal);
  assert.ok(calls[0].url.includes('/me/player/play?device_id=fixture-device'));
  assert.equal(calls[0].options.headers.Authorization, 'Bearer fixture-token');
  assert.equal(JSON.parse(calls[0].options.body).uris[0], 'spotify:track:fixture');
  let event; const unsubscribe = player.subscribe(value => { event = value; });
  instance.listeners.player_state_changed({ paused: false, position: 123 }); assert.equal(event.position, 123); unsubscribe();
  await player.seek(2.5); assert.equal(calls.at(-1)[1], 2500);
  await player.volume(20); assert.equal(calls.at(-1)[1], .2);
  const controller = new AbortController(); controller.abort();
  const before = calls.length; await assert.rejects(() => player.play('spotify:track:cancelled', controller.signal)); assert.equal(calls.length, before);
  player.disconnect(); assert.equal(disconnected, 1);
  console.log('PASS official Spotify playback endpoint, own token, SDK state, seek/volume and cancelled playback');
})().catch(error => { console.error(error); process.exitCode = 1; });

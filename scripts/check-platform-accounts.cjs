const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const storage = () => { const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const localStorage = storage(), sessionStorage = storage();
localStorage.setItem('qqMusicCookie', 'qq-fixture'); sessionStorage.setItem('neteaseCookie', 'netease-fixture'); sessionStorage.setItem('melorankSpotifyTokens', 'spotify-fixture');
let cursor = 0, slots = [], context, events = [];
const react = {
  createContext: () => { context = { Provider: 'provider' }; return context; },
  createElement: (type, props) => { if (type === 'provider') context.value = props.value; return null; },
  useContext: () => context.value,
  useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update; }]; },
  useRef: initial => { const index = cursor++; return slots[index] || (slots[index] = { current: initial }); },
  useCallback: callback => callback,
  useEffect() {},
};
let resolveNet;
const netease = { cookie: () => sessionStorage.getItem('neteaseCookie'), request: async () => ({ nickname: 'Net user' }), logout: async () => sessionStorage.removeItem('neteaseCookie') };
const spotify = { finish: async () => false, request: async () => ({ display_name: 'Spotify user' }), logout: () => sessionStorage.removeItem('melorankSpotifyTokens') };
const qqMusicService = { getUserInfo: async () => ({ nickname: 'QQ user' }), logout: () => localStorage.removeItem('qqMusicCookie') };
const sandbox = { exports: {}, localStorage, sessionStorage, Event, window: { dispatchEvent: event => events.push(event.type) }, require: name => name === 'react' ? react : name.includes('musicPlatforms') ? { netease, spotify } : { qqMusicService } };
const code = ts.transpileModule(fs.readFileSync('src/app/contexts/PlatformAccountsContext.tsx', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
vm.runInNewContext(code, sandbox);
const render = () => { cursor = 0; sandbox.exports.PlatformAccountsProvider({ children: null }); return context.value; };
(async () => {
  await render().refresh();
  let state = render();
  assert.equal(state.accounts.qq.nickname, 'QQ user'); assert.equal(state.accounts.netease.nickname, 'Net user'); assert.equal(state.accounts.spotify.nickname, 'Spotify user');
  assert.equal(state.activeProvider, 'netease');
  state.selectProvider('spotify'); state = render(); assert.equal(state.activeProvider, 'spotify');
  assert.ok(state.accounts.qq.connected && state.accounts.netease.connected && state.accounts.spotify.connected);
  await state.disconnect('netease'); state = render();
  assert.equal(state.accounts.netease.connected, false); assert.ok(state.accounts.qq.connected && state.accounts.spotify.connected);
  assert.equal(localStorage.getItem('qqMusicCookie'), 'qq-fixture'); assert.equal(sessionStorage.getItem('melorankSpotifyTokens'), 'spotify-fixture');
  sessionStorage.setItem('neteaseCookie', 'old-account');
  netease.request = () => new Promise(resolve => { resolveNet = resolve; });
  const pending = state.refresh('netease');
  sessionStorage.setItem('neteaseCookie', 'new-account');
  resolveNet({ nickname: 'Stale user' }); await pending;
  assert.notEqual(render().accounts.netease.nickname, 'Stale user');
  console.log('PASS simultaneous platform accounts, independent logout, active selection and stale profile isolation');
})().catch(error => { console.error(error); process.exitCode = 1; });

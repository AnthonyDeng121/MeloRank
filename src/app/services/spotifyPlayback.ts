import { spotify } from './musicPlatforms';

export interface SpotifyState { paused: boolean; position: number; duration: number; track_window: { current_track: { uri: string } } }
let player: any = null, ready: Promise<string> | null = null, epoch = 0;
let sdk: Promise<void> | null = null;
let cancelConnection: (() => void) | null = null;
const subscribers = new Set<(state: SpotifyState) => void>();
function loadSdk() {
  if ((window as any).Spotify) return Promise.resolve();
  if (!sdk) sdk = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => { sdk = null; reject(new Error('Spotify 播放器加载超时')); }, 15000);
    (window as any).onSpotifyWebPlaybackSDKReady = () => { clearTimeout(timeout); resolve(); };
    const script = document.createElement('script'); script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true;
    script.onerror = () => { clearTimeout(timeout); script.remove(); sdk = null; reject(new Error('无法加载 Spotify 官方播放器')); };
    document.head.appendChild(script);
  });
  return sdk;
}
async function device() {
  if (ready) return ready;
  const version = epoch;
  await loadSdk();
  if (version !== epoch) throw new DOMException('已取消', 'AbortError');
  if (ready) return ready;
  ready = new Promise<string>((resolve, reject) => {
    player = new (window as any).Spotify.Player({ name: 'MeloRank', volume: .2, getOAuthToken: (callback: (token: string) => void) => { spotify.token().then(callback).catch(() => callback('')); } });
    const timeout = setTimeout(() => reject(new Error('Spotify 播放设备连接超时')), 15000);
    cancelConnection = () => { clearTimeout(timeout); reject(new DOMException('已取消', 'AbortError')); };
    const fail = ({ message }: { message: string }) => { clearTimeout(timeout); if (version === epoch) cancelConnection = null; reject(new Error(message || 'Spotify 播放器初始化失败')); };
    player.addListener('ready', ({ device_id }: { device_id: string }) => { clearTimeout(timeout); if (version === epoch) cancelConnection = null; resolve(device_id); });
    player.addListener('initialization_error', fail);
    player.addListener('authentication_error', () => fail({ message: 'Spotify 播放授权失效，请退出该平台后重新授权' }));
    player.addListener('account_error', () => fail({ message: 'Spotify 站内播放需要 Premium 账号' }));
    player.addListener('player_state_changed', (state: SpotifyState | null) => { if (state && version === epoch) subscribers.forEach(callback => callback(state)); });
    player.connect().then((connected: boolean) => { if (!connected) fail({ message: 'Spotify 播放器连接失败' }); }).catch(fail);
  });
  try { return await ready; } catch (error) { if (version === epoch) spotifyPlayback.disconnect(); throw error; }
}
export const spotifyPlayback = {
  subscribe(callback: (state: SpotifyState) => void) { subscribers.add(callback); return () => { subscribers.delete(callback); }; },
  async play(uri: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const version = epoch, id = await device(); signal.throwIfAborted();
    if (version !== epoch) throw new DOMException('已取消', 'AbortError');
    await player.activateElement();
    const token = await spotify.token(); signal.throwIfAborted();
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(id)}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ uris: [uri] }), signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
    if (!response.ok) throw new Error(response.status === 403 ? 'Spotify 拒绝播放，请确认 Premium 资格并重新授予播放权限' : 'Spotify 播放请求失败，请重试');
  },
  async resume() { if (player) { await player.activateElement(); await player.resume(); } },
  async pause() { if (player) await player.pause(); },
  async seek(seconds: number) { if (player) await player.seek(Math.round(seconds * 1000)); },
  async volume(value: number) { if (player) await player.setVolume(value / 100); },
  async state(): Promise<SpotifyState | null> { return player ? player.getCurrentState() : null; },
  disconnect() { epoch++; cancelConnection?.(); cancelConnection = null; player?.disconnect(); player = null; ready = null; },
};

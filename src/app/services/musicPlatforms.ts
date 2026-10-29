export type MusicProvider = 'qq' | 'netease' | 'spotify';
export type LibraryKind = 'playlists' | 'liked' | 'albums';
export interface LibraryItem { id: string; title: string; subtitle: string; image?: string; externalUrl: string; qqSong?: any }
export interface LibraryPage { items: LibraryItem[]; hasMore: boolean }

const backend = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
export const netease = {
  cookie: () => sessionStorage.getItem('neteaseCookie') || '',
  async request(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(`${backend}/api/music/netease/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': this.cookie() }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401) sessionStorage.removeItem('neteaseCookie'); throw new Error(data.error || '网易云音乐请求失败'); }
    return data;
  },
  async logout() {
    const cookie = this.cookie();
    sessionStorage.removeItem('neteaseCookie');
    if (cookie) await fetch(`${backend}/api/music/netease/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Netease-Cookie': cookie } }).catch(() => {});
  },
};

interface SpotifyTokens { access_token: string; refresh_token?: string; expiresAt: number }
const tokenKey = 'melorankSpotifyTokens';
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
const tokens = (): SpotifyTokens | null => { try { return JSON.parse(sessionStorage.getItem(tokenKey) || 'null'); } catch { return null; } };
let callback: Promise<boolean> | null = null;
let refreshing: Promise<string> | null = null;
let spotifyEpoch = 0;

export const spotify = {
  clientId: () => localStorage.getItem('spotifyClientId') || import.meta.env.VITE_SPOTIFY_CLIENT_ID || '',
  connected: () => !!tokens()?.access_token,
  redirectUri: () => {
    const configured = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
    if (configured) {
      try {
        const url = new URL(configured);
        if (url.protocol === 'https:' || url.protocol === 'http:' && url.hostname === '127.0.0.1') return configured;
      } catch { /* Use a valid loopback callback when old configuration is invalid. */ }
    }
    return location.protocol === 'https:' ? `${location.origin}${location.pathname}` : 'http://127.0.0.1:5188/';
  },
  async begin(clientId: string) {
    if (!/^[a-z0-9]{32}$/i.test(clientId)) throw new Error('请填写开发者应用中的 32 位 Client ID');
    localStorage.setItem('spotifyClientId', clientId);
    const redirectUri = this.redirectUri();
    if (new URL(redirectUri).origin !== location.origin) {
      if (location.hostname === 'localhost' && new URL(redirectUri).hostname === '127.0.0.1') {
        location.assign(`${redirectUri}?connectSpotify=1&spotifyClientId=${encodeURIComponent(clientId)}`); return;
      }
      throw new Error('当前页面与回调地址需使用同一来源，请先打开配置的回调地址');
    }
    const verifier = random(), state = random();
    sessionStorage.setItem('spotifyPkce', JSON.stringify({ verifier, state, clientId, redirectUri, createdAt: Date.now() }));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const params = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri, state, code_challenge_method: 'S256', code_challenge: challenge, scope: 'playlist-read-private user-library-read user-read-private' });
    location.assign(`https://accounts.spotify.com/authorize?${params}`);
  },
  async finish(): Promise<boolean> {
    if (callback) return callback;
    callback = (async () => {
      const params = new URLSearchParams(location.search);
      if (params.get('connectSpotify') === '1') {
        const id = params.get('spotifyClientId') || '';
        history.replaceState(null, '', location.pathname); await this.begin(id); return false;
      }
      if (!params.has('code') && !params.has('error')) return false;
      let pending: any;
      try { pending = JSON.parse(sessionStorage.getItem('spotifyPkce') || 'null'); } catch { /* invalid pending session */ }
      history.replaceState(null, '', location.pathname);
      sessionStorage.removeItem('spotifyPkce');
      if (!pending || pending.state !== params.get('state') || Date.now() - pending.createdAt > 600000) throw new Error('Spotify 授权校验失败，请重新登录');
      if (params.has('error')) throw new Error('Spotify 授权未完成');
      const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code')!, redirect_uri: pending.redirectUri, client_id: pending.clientId, code_verifier: pending.verifier }) });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error(data.error_description || 'Spotify 授权失败');
      sessionStorage.setItem(tokenKey, JSON.stringify({ ...data, expiresAt: Date.now() + data.expires_in * 1000 }));
      return true;
    })();
    try { return await callback; } finally { callback = null; }
  },
  async token(): Promise<string> {
    const current = tokens();
    if (!current) throw new Error('请先登录 Spotify');
    if (current.expiresAt > Date.now() + 30000) return current.access_token;
    if (!current.refresh_token) { this.logout(); throw new Error('Spotify 登录已过期，请重新授权'); }
    const epoch = spotifyEpoch;
    if (!refreshing) refreshing = (async () => {
      const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refresh_token!, client_id: this.clientId() }) });
      const data = await response.json();
      if (epoch !== spotifyEpoch) throw new Error('Spotify 已断开连接');
      if (!response.ok || !data.access_token) { this.logout(); throw new Error('Spotify 登录已失效，请重新授权'); }
      sessionStorage.setItem(tokenKey, JSON.stringify({ ...current, ...data, expiresAt: Date.now() + data.expires_in * 1000 }));
      return data.access_token as string;
    })();
    try { return await refreshing; } finally { refreshing = null; }
  },
  async request(path: string) {
    const response = await fetch(`https://api.spotify.com/v1${path}`, { headers: { Authorization: `Bearer ${await this.token()}` }, signal: AbortSignal.timeout(20000) });
    if (response.status === 401) { this.logout(); throw new Error('Spotify 登录已失效，请重新授权'); }
    if (response.status === 403) throw new Error('Spotify 拒绝访问，请检查应用开发模式用户白名单、账号条件和授权范围');
    if (response.status === 429) throw new Error(`Spotify 请求过于频繁，请在 ${response.headers.get('Retry-After') || '稍后'} 秒后重试`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Spotify 请求失败');
    return data;
  },
  async library(kind: LibraryKind, offset: number): Promise<LibraryPage> {
    const path = kind === 'playlists' ? '/me/playlists' : kind === 'liked' ? '/me/tracks' : '/me/albums';
    const data = await this.request(`${path}?limit=30&offset=${offset}`);
    return { items: (data.items || []).map((item: any) => {
      const value = kind === 'liked' ? item.track : kind === 'albums' ? item.album : item;
      return value ? { id: value.id, title: value.name, subtitle: kind === 'playlists' ? value.owner?.display_name || 'Spotify 歌单' : (value.artists || []).map((a: any) => a.name).join(' / '), image: (value.images || value.album?.images)?.[0]?.url, externalUrl: value.external_urls?.spotify || '' } : null;
    }).filter(Boolean), hasMore: !!data.next };
  },
  logout() { spotifyEpoch++; sessionStorage.removeItem(tokenKey); sessionStorage.removeItem('spotifyPkce'); },
};

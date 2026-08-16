import SpotifyWebApi from 'spotify-web-api-js';
import { SPOTIFY_CONFIG } from './spotifyConfig';

const spotifyApi = new SpotifyWebApi();

class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    // 检查本地存储中是否有令牌
    const savedToken = localStorage.getItem('spotifyAccessToken');
    const savedExpiry = localStorage.getItem('spotifyTokenExpiry');
    
    if (savedToken && savedExpiry) {
      const expiryTime = parseInt(savedExpiry);
      if (expiryTime > Date.now()) {
        this.accessToken = savedToken;
        this.tokenExpiry = expiryTime;
        spotifyApi.setAccessToken(savedToken);
      } else {
        this.logout();
      }
    }
  }

  // 生成授权URL
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      redirect_uri: SPOTIFY_CONFIG.redirectUri,
      scope: SPOTIFY_CONFIG.scopes,
      response_type: 'token',
      show_dialog: 'true'
    });
    
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  // 从URL哈希中提取令牌
  handleCallback(hash: string): boolean {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');
    
    if (accessToken && expiresIn) {
      const expiryTime = Date.now() + parseInt(expiresIn) * 1000;
      this.accessToken = accessToken;
      this.tokenExpiry = expiryTime;
      
      // 保存到本地存储
      localStorage.setItem('spotifyAccessToken', accessToken);
      localStorage.setItem('spotifyTokenExpiry', expiryTime.toString());
      
      // 设置API访问令牌
      spotifyApi.setAccessToken(accessToken);
      
      return true;
    }
    
    return false;
  }

  // 检查是否已登录
  isLoggedIn(): boolean {
    return !!(this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now());
  }

  // 登出
  logout(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
    localStorage.removeItem('spotifyAccessToken');
    localStorage.removeItem('spotifyTokenExpiry');
    spotifyApi.setAccessToken('');
  }

  // 获取访问令牌
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // 搜索音乐
  async search(query: string, type: 'track' | 'album' | 'artist' | 'playlist' = 'track', limit: number = 10): Promise<any> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to Spotify');
    }
    
    try {
      return await spotifyApi.search(query, [type], { limit });
    } catch (error) {
      console.error('Spotify search error:', error);
      throw error;
    }
  }

  // 获取当前播放状态
  async getMyCurrentPlaybackState(): Promise<any> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to Spotify');
    }
    
    try {
      return await spotifyApi.getMyCurrentPlaybackState();
    } catch (error) {
      console.error('Spotify get playback state error:', error);
      throw error;
    }
  }

  // 播放音乐
  async play(uris?: string[]): Promise<void> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to Spotify');
    }
    
    try {
      if (uris) {
        await spotifyApi.play({ uris });
      } else {
        await spotifyApi.play();
      }
    } catch (error) {
      console.error('Spotify play error:', error);
      throw error;
    }
  }

  // 暂停音乐
  async pause(): Promise<void> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to Spotify');
    }
    
    try {
      await spotifyApi.pause();
    } catch (error) {
      console.error('Spotify pause error:', error);
      throw error;
    }
  }

  // 获取用户播放列表
  async getUserPlaylists(): Promise<any> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to Spotify');
    }
    
    try {
      return await spotifyApi.getUserPlaylists();
    } catch (error) {
      console.error('Spotify get user playlists error:', error);
      throw error;
    }
  }
}

export const spotifyService = new SpotifyService();

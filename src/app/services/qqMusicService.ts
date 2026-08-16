import { QQ_MUSIC_CONFIG } from './qqMusicConfig';

class QQMusicService {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;
  private userId: string | null = null;
  private cookie: string | null = null;
  
  // 搜索结果缓存
  private cache = new Map<string, { value: any; expire: number }>();
  
  // 设置缓存
  private setCache(key: string, value: any, ttl: number = 10 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      expire: Date.now() + ttl
    });
  }
  
  // 获取缓存
  private getCache(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expire) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  constructor() {
    this.baseUrl = QQ_MUSIC_CONFIG.baseUrl;
    this.loadTokens();
  }

  // 从本地存储加载令牌
  private loadTokens(): void {
    const savedAccessToken = localStorage.getItem('qqMusicAccessToken');
    const savedRefreshToken = localStorage.getItem('qqMusicRefreshToken');
    const savedTokenExpiry = localStorage.getItem('qqMusicTokenExpiry');
    const savedUserId = localStorage.getItem('qqMusicUserId');
    const savedCookie = localStorage.getItem('qqMusicCookie');

    if (savedAccessToken && savedRefreshToken && savedTokenExpiry && savedUserId) {
      const expiryTime = parseInt(savedTokenExpiry);
      if (expiryTime > Date.now()) {
        this.accessToken = savedAccessToken;
        this.refreshToken = savedRefreshToken;
        this.tokenExpiry = expiryTime;
        this.userId = savedUserId;
      } else {
        this.logout();
      }
    }
    
    // 单独处理cookie，因为扫码登录可能没有token
    if (savedCookie) {
      this.cookie = savedCookie;
    }
  }

  // 保存令牌到本地存储
  private saveTokens(): void {
    if (this.accessToken && this.refreshToken && this.tokenExpiry && this.userId) {
      localStorage.setItem('qqMusicAccessToken', this.accessToken);
      localStorage.setItem('qqMusicRefreshToken', this.refreshToken);
      localStorage.setItem('qqMusicTokenExpiry', this.tokenExpiry.toString());
      localStorage.setItem('qqMusicUserId', this.userId);
    }
    
    // 单独保存cookie
    if (this.cookie) {
      localStorage.setItem('qqMusicCookie', this.cookie);
    }
  }

  // 通用请求方法
  private async request(endpoint: string, params?: Record<string, any>, requiresAuth: boolean = false, method: string = 'GET'): Promise<any> {
    try {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };

      // 如果有cookie，添加到请求头
      if (this.cookie) {
        headers['Cookie'] = this.cookie;
      }
      
      // 如果需要认证且有令牌，添加认证头
      if (requiresAuth && this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const options: RequestInit = {
        method,
        headers,
        mode: 'cors' // 允许跨域请求
      };

      if (method === 'GET' && params) {
        // GET请求将参数添加到URL
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      } else if (params) {
        // POST请求将参数放在请求体中
        options.body = JSON.stringify(params);
      }

      console.log('QQ Music API Request:', `${method} ${url.toString()}`);
      if (options.body) {
        console.log('QQ Music API Request Body:', options.body);
      }

      const response = await fetch(url.toString(), options);
      
      console.log('QQ Music API Response Status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('QQ Music API Response Data:', data);
      return data;
    } catch (error) {
      console.error('QQ Music API error:', error);
      throw error;
    }
  }

  // 获取登录二维码
  async getLoginQr(): Promise<any> {
    // 根据qq-music-api仓库的实现，正确的端点是 /user/getQQLoginQr
    return await this.request('/user/getQQLoginQr');
  }

  // 检查登录状态
  async checkLoginStatus(params: { ptqrtoken: string; qrsig: string }): Promise<any> {
    // 根据qq-music-api仓库的实现，正确的端点是 /user/checkQQLoginQr
    const result = await this.request('/user/checkQQLoginQr', params, false, 'POST');
    
    // 如果登录成功，保存cookie
    if (result.isOk && result.cookie) {
      this.cookie = result.cookie;
      this.saveTokens();
    }
    
    return result;
  }

  // 检查是否已登录
  isLoggedIn(): boolean {
    // 有cookie就算已登录，因为扫码登录可能没有token
    return !!(this.cookie || (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now()));
  }

  // 登录
  async login(key: string): Promise<any> {
    try {
      // 这里简化了登录流程，实际应该先获取二维码key，然后生成二维码，再轮询检查登录状态
      // 但根据qq-music-api的实现，可能直接提供了更简单的登录方式
      const response = await this.request('/login', {
        key,
        timestamp: Date.now()
      });

      if (response.code === 200 && response.data) {
        this.accessToken = response.data.access_token || response.data.token;
        this.refreshToken = response.data.refresh_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in || 7200) * 1000;
        this.userId = response.data.userId || response.data.uin;
        this.saveTokens();
      }

      return response;
    } catch (error) {
      console.error('QQ Music login error:', error);
      throw error;
    }
  }

  // 登出
  logout(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.userId = null;
    this.cookie = null;
    localStorage.removeItem('qqMusicAccessToken');
    localStorage.removeItem('qqMusicRefreshToken');
    localStorage.removeItem('qqMusicTokenExpiry');
    localStorage.removeItem('qqMusicUserId');
    localStorage.removeItem('qqMusicCookie');
  }
  
  // 设置cookie
  setCookie(cookie: string): void {
    this.cookie = cookie;
    this.saveTokens();
  }

  // 获取当前用户信息
  async getUserInfo(): Promise<any> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to QQ Music');
    }

    try {
      // Try the actual endpoint first
      const response = await this.request('/user/account', {}, false);
      console.log('QQ Music API getUserInfo response:', JSON.stringify(response, null, 2));
      
      // 直接返回响应数据，因为后端已经处理了昵称
      return response;
    } catch (error) {
      console.error('Error getting user info:', error);
      // 发生错误时，返回包含默认昵称的响应
      return { 
        body: {
          nickname: 'QQ Music User'
        }
      };
    }
  }

  // 获取用户歌单
  async getUserPlaylists(): Promise<any> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to QQ Music');
    }

    try {
      return await this.request('/user/playlist', {
        uid: this.userId
      }, true);
    } catch (error) {
      console.warn('QQ Music API does not support getUserPlaylists endpoint, returning empty array');
      return { 
        body: {
          playlist: []
        }
      };
    }
  }

  // 获取用户收藏的歌曲
  async getUserLikedSongs(): Promise<any> {
    if (!this.isLoggedIn()) {
      throw new Error('Not logged in to QQ Music');
    }

    try {
      return await this.request('/likelist', {
        uid: this.userId
      }, true);
    } catch (error) {
      console.warn('QQ Music API does not support getUserLikedSongs endpoint, returning empty array');
      return { 
        body: {
          ids: []
        }
      };
    }
  }

  // 搜索音乐
  async search(query: string, limit: number = 10, page: number = 1): Promise<any> {
    return this.searchWithType(query, limit, 'songs', page);
  }

  // 根据类型搜索音乐
  async searchWithType(query: string, limit: number = 10, type: 'songs' | 'albums' | 'artists', page: number = 1): Promise<any> {
    // 根据qq-music-api仓库的路由配置，正确的搜索端点是/getSearchByKey
    // 使用GET请求，参数作为查询字符串传递
    try {
      // 根据类型设置不同的catZhida参数
    let catZhida = 0; // 默认是歌曲
    if (type === 'albums') {
      catZhida = 3; // 专辑
    } else if (type === 'artists') {
      catZhida = 2; // 艺术家
    }
      
      const params = {
        w: query,
        limit: limit,
        page: page,
        catZhida: catZhida,
        remoteplace: 'txt.yqq.song',
        aggr: 1
      };
      
      // 生成缓存键（包含所有搜索参数）
      const cacheKey = `search_${query}_${type}_${limit}_${page}_${catZhida}`;
      
      // 先检查缓存
      const cachedResult = this.getCache(cacheKey);
      if (cachedResult) {
        console.log('Using cached search result for:', cacheKey);
        return cachedResult;
      }
      
      console.log('QQ Music Search Params:', params);
      const result = await this.request('/getSearchByKey', params);
      console.log('QQ Music Search Raw Result:', result);
      
      // 处理API响应，提取真正的搜索结果数据
      let processedResult = result;
      if (result.body) {
        // 当直接调用API时，返回格式为 { status: 200, body: { response: {...} } }
        processedResult = result.body;
      }
      
      // 将结果存入缓存（10分钟过期）
      this.setCache(cacheKey, processedResult, 10 * 60 * 1000);
      
      return processedResult;
    } catch (error) {
      console.error('QQ Music Search Error:', error);
      throw error;
    }
  }

  // 获取歌曲详情
  async getSongDetail(songId: string): Promise<any> {
    return await this.request('/song/detail', {
      ids: songId
    });
  }

  // 获取歌曲播放URL
  async getSongUrl(songmid: string): Promise<any> {
    return await this.request('/getMusicPlay', {
      songmid: songmid
    });
  }

  // 获取歌曲歌词
  async getLyric(songmid: string): Promise<any> {
    return await this.request('/getLyric', {
      songmid: songmid
    });
  }

  // 获取歌单详情
  async getPlaylistDetail(playlistId: string): Promise<any> {
    return await this.request('/playlist/detail', {
      id: playlistId
    });
  }

  // 获取歌手热门歌曲
  async getArtistTopSongs(artistId: string): Promise<any> {
    return await this.request('/artist/top/song', {
      id: artistId
    });
  }

  // 获取新碟信息
  async getNewAlbums(limit: number = 10): Promise<any> {
    return await this.request('/top/album', {
      limit
    });
  }

  // 获取排行榜
  async getTopList(): Promise<any> {
    return await this.request('/toplist');
  }

  // 获取推荐歌单
  async getRecommendedPlaylists(limit: number = 10): Promise<any> {
    return await this.request('/personalized', {
      limit
    });
  }
}

export const qqMusicService = new QQMusicService();

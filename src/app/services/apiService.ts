// API服务配置
const API_BASE_URL = 'http://localhost:5000/api';

// 通用请求函数
const request = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // 默认请求配置
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };
  
  // 检查是否有QQ音乐cookie
  const qqMusicCookie = localStorage.getItem('qqMusicCookie');
  if (qqMusicCookie) {
    // 添加QQ音乐cookie到请求头，供后端认证使用
    (defaultOptions.headers as any)['X-QQ-Music-Cookie'] = qqMusicCookie;
  }
  
  try {
    console.log(`正在发送请求: ${url}`);
    console.log('请求选项:', defaultOptions);
    const response = await fetch(url, defaultOptions);
    console.log(`请求响应状态: ${response.status}`);
    const data = await response.json();
    console.log('请求响应数据:', data);
    
    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }
    
    return data;
  } catch (error) {
    console.error('API请求错误:', error);
    throw error;
  }
};

// 数据存储相关API
export const dataAPI = {
  // 保存或更新用户数据
  saveData: async (type: string, data: any) => {
    return request('/data', {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    });
  },
  
  // 获取特定类型的数据
  getData: async (type: string) => {
    return request(`/data/${type}`);
  },
  
  // 获取所有用户数据
  getAllData: async () => {
    return request('/data');
  },
  
  // 删除特定类型的数据
  deleteData: async (type: string) => {
    return request(`/data/${type}`, {
      method: 'DELETE',
    });
  },
};
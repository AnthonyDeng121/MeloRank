import axios from 'axios';
import fs from 'fs';
import path from 'path';

// 从配置文件读取cookie
const configPath = path.join(__dirname, 'qq-music-api-main', 'config', 'user-info.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// 测试QQ音乐用户信息接口
async function testUserInfo() {
  try {
    // 直接调用QQ音乐的用户信息接口
    const url = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
    const params = {
      cmd: 'getUserInfo',
      needNewCode: 0,
      platform: 'yqq',
      hostUin: 0,
      loginUin: config.loginUin || 0,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8'
    };

    const response = await axios.get(url, {
      params: params,
      headers: {
        referer: 'https://y.qq.com/portal/player.html',
        host: 'u.y.qq.com',
        cookie: config.cookie
      },
      timeout: 10000
    });

    console.log('QQ音乐API返回的原始数据:', JSON.stringify(response.data, null, 2));
    
    // 检查响应中是否包含用户信息和昵称
    if (response.data && response.data.req_0 && response.data.req_0.data) {
      const userInfo = response.data.req_0.data;
      console.log('解析后的用户信息:', JSON.stringify(userInfo, null, 2));
      console.log('昵称字段:', userInfo.nickname || '未找到nickname字段');
      console.log('所有可用字段:', Object.keys(userInfo));
    } else {
      console.log('响应格式不符合预期');
    }
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testUserInfo();

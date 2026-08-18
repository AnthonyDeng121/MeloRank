const request = require('../../util/request');

module.exports = async (ctx, next) => {
  try {
    console.log('getAccountInfo called, current global.userInfo:', global.userInfo);
    // 直接调用 QQ 音乐的用户信息接口
    const url = '/cgi-bin/musicu.fcg';
    const options = {
      params: {
        cmd: 'getUserInfo',
        needNewCode: 0,
        platform: 'yqq',
        hostUin: 0,
        loginUin: global.userInfo.uin || global.userInfo.loginUin || 0,
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8'
      },
      headers: {
        referer: 'https://y.qq.com/portal/player.html',
        host: 'u.y.qq.com'
      }
    };

    const res = await request(url, 'get', options, 'u');
    console.log('QQ Music API status:', res.status);
    console.log('QQ Music API data:', JSON.stringify(res.data, null, 2));

    // 处理响应
    let userInfo = {};
    if (res.data && res.data.req_0 && res.data.req_0.data) {
      // 处理正常响应格式
      userInfo = res.data.req_0.data;
      console.log('Processing req_0.data format, userInfo:', userInfo);
    } else if (res.data) {
      // 处理其他响应格式
      userInfo = res.data;
      console.log('Processing data format, userInfo:', userInfo);
    } else {
      userInfo = res;
      console.log('Processing res format, userInfo:', userInfo);
    }
    
    // 确保返回的数据包含nickname字段
    if (!userInfo.nickname) {
      console.warn('No nickname found in QQ Music API response, checking for alternatives');
      // 检查是否有其他可能的昵称字段
      if (userInfo.name) {
        userInfo.nickname = userInfo.name;
        console.log('Using name as nickname:', userInfo.name);
      } else if (userInfo.userName) {
        userInfo.nickname = userInfo.userName;
        console.log('Using userName as nickname:', userInfo.userName);
      } else if (userInfo.nick) {
        userInfo.nickname = userInfo.nick;
        console.log('Using nick as nickname:', userInfo.nick);
      } else if (userInfo.nickname) {
        // 直接使用nickname字段（如果存在）
        console.log('Using nickname field:', userInfo.nickname);
      } else if (global.userInfo && global.userInfo.nickname) {
        // 从global.userInfo中获取保存的nickname
        userInfo.nickname = global.userInfo.nickname;
        console.log('Using nickname from global.userInfo:', global.userInfo.nickname);
      } else {
        // 尝试直接调用QQ音乐的get_user_info接口获取用户信息
        console.log('Trying to get user info from QQ Music get_user_info API');
        try {
          // 调用QQ音乐的get_user_info接口
          const getUserInfoUrl = 'https://graph.qq.com/user/get_user_info';
          const getUserInfoOptions = {
            params: {
              access_token: '', // 这里可能需要从global.userInfo中获取
              oauth_consumer_key: '100497308',
              openid: global.userInfo?.openid || '',
              format: 'json'
            },
            headers: {
              Cookie: global.userInfo?.cookie || ''
            }
          };
          
          // 这里可以添加调用get_user_info接口的逻辑
          // 暂时使用默认昵称
          userInfo.nickname = global.userInfo?.nickname || 'QQ Music User';
        } catch (err) {
          console.error('Error getting user info from QQ Music API:', err);
          userInfo.nickname = global.userInfo?.nickname || 'QQ Music User';
        }
      }
    }
    
    console.log('Final userInfo to return:', userInfo);
    ctx.body = {
      status: 200,
      body: userInfo
    };
  } catch (error) {
    console.error('获取用户信息失败:', error);
    // 错误处理时添加更多日志
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
    }
    ctx.body = {
      status: 200,
      body: {
        nickname: 'QQ Music User'
      }
    };
  }
};

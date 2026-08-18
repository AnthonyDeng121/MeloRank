const { hash33 } = require('../../../util/loginUtils');

module.exports = async ({ method = 'get', params = {}, option = {} }) => {
  // 生成随机t参数，避免缓存
  const randomT = Math.random();
  const url = `https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=${randomT}&daid=383&pt_3rd_aid=100497308&u1=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump`;
  try {
    // Node.js fetch不支持responseType选项，直接获取response
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // 使用arrayBuffer()方法获取二进制数据，然后转换为Buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const img = "data:image/png;base64," + buffer.toString('base64');
    const qrsig = response.headers.get('Set-Cookie')?.match(/qrsig=([^;]+)/)?.[1];
    
    if (!qrsig) {
      throw new Error('Failed to get qrsig from response headers');
    }
    
    return {status: 200, body: { img, ptqrtoken: hash33(qrsig), qrsig } };
  } catch (error) {
    console.error('Error getting QQ login QR:', error);
    return {status: 500, body: { error: '获取二维码失败: ' + error.message } };
  }
};

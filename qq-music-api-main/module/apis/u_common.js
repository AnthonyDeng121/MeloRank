const request = require('../../util/request');
const config = require('../config');
const userInfoConfig = require('../../config/user-info');

module.exports = ({ options = {}, method = 'get', cookie = null }) => {
	// 优先使用传递过来的cookie，其次是options.headers中的cookie，最后是全局配置
	const cookieToUse = cookie || options.headers?.cookie || global.userInfo.cookie;
	
	let opts = Object.assign(options, config.commonParams, {
		headers: {
			referer: 'https://y.qq.com/portal/player.html',
			host: 'u.y.qq.com',
			'content-type': 'application/x-www-form-urlencoded',
			'cookie': cookieToUse,
		},
	});
	return request('/cgi-bin/musicu.fcg', method, opts, 'u', cookieToUse);
};

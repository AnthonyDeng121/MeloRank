const { UCommon } = require('../../module');
const { _guid } = require('../../module/config');
const get = require('lodash.get');

// songmid=003rJSwm3TechU
// songmid=001yNIo41SJjuC,001wPuVc4ZiMhj
module.exports = async (ctx, next) => {
	// 从请求头获取cookie
	const requestCookie = ctx.request.headers['cookie'] || '';
	// 从请求头获取X-QQ-Music-Cookie
	const xQqMusicCookie = ctx.request.headers['x-qq-music-cookie'] || '';
	// 优先使用X-QQ-Music-Cookie，其次是普通Cookie，最后是全局配置
	const cookie = xQqMusicCookie || requestCookie || global.userInfo.cookie;
	
	// 从cookie中提取uin
	let uin = '0';
	if (cookie) {
		const uinMatch = cookie.match(/uin=(\w+)/) || cookie.match(/ uin=(\w+)/);
		if (uinMatch && uinMatch[1]) {
			uin = uinMatch[1];
		}
	}
	
	const songmid = ctx.query.songmid + '';
	// response data only need play url value (all play)
	const justPlayUrl = (ctx.query.resType || 'play') === 'play';
	const guid = _guid ? _guid + '' : '1429839143';
	let {quality = 128, mediaId} = ctx.query;
	const fileType = {
		m4a: {
			s: 'C400',
			e: '.m4a',
		},
		128: {
			s: 'M500',
			e: '.mp3',
		},
		320: {
			s: 'M800',
			e: '.mp3',
		},
		ape: {
			s: 'A000',
			e: '.ape',
		},
		flac: {
			s: 'F000',
			e: '.flac',
		}
	};
	const songmidList = songmid.split(',');
	const fileInfo = fileType[quality];
	const file = songmidList.map(_ => `${fileInfo.s}${_}${mediaId || _}${fileInfo.e}`);
	// 设置loginflag为1表示已登录，0表示未登录
	const loginflag = cookie ? 1 : 0;
	const data = {
		req_0: {
			module: 'vkey.GetVkeyServer',
			method: 'CgiGetVkey',
			param: {
				filename: file,
				guid,
				songmid: songmidList,
				songtype: [0],
				uin,
				loginflag,
				platform: '20',
			},
		},
		loginUin: uin,
		comm: {
			uin,
			format: 'json',
			ct: 24,
			cv: 0,
		},
	};
	const params = Object.assign({
		format: 'json',
		sign: 'zzannc1o6o9b4i971602f3554385022046ab796512b7012',
		data: JSON.stringify(data),
	});
	const props = {
		method: 'get',
		params,
		option: {
			headers: {
				'cookie': cookie
			}
		},
		cookie: cookie // 传递cookie给UCommon
	};

	if (songmid) {
		await UCommon(props)
			.then(res => {
				const response = res.data;
				const domain = get(response, 'req_0.data.sip', [])
					.find(i => !i.startsWith('http://ws'))
					|| get(response, 'req_0.data.sip[0]');

				let playUrl = {};
				get(response, 'req_0.data.midurlinfo', []).forEach((item) => {
					const hasUrl = !!item.purl;
					playUrl[item.songmid] = {
						url: hasUrl ? `${domain}${item.purl}`  : '',
						error: !hasUrl && (
							loginflag ? 'VIP歌曲或当前版权受限' : '请先登录以获取播放链接'
						)
					};
				});
				response.playUrl = playUrl;
				ctx.body = {
					data: justPlayUrl ? {playUrl} : response,
				};
			})
			.catch(error => {
				console.error('获取播放链接失败:', error);
				ctx.status = 500;
				ctx.body = {
					data: {
						error: '获取播放链接失败',
						message: error.message || '网络错误'
					}
				};
			});
	} else {
		ctx.status = 400;
		ctx.body = {
			data: {
				message: 'no songmid',
			}
		};
	}
};

const { UCommon } = require('../../module');
const { _guid } = require('../../module/config');
const get = require('lodash.get');
const { resolveCookie, getUin } = require('../../util/requestAuth');

// songmid=003rJSwm3TechU
// songmid=001yNIo41SJjuC,001wPuVc4ZiMhj
module.exports = async (ctx, next) => {
	// Only the current request's explicit music credential is used.
	const cookie = resolveCookie();
	
	const uin = getUin(cookie);
	
	const songmid = String(ctx.query.songmid || ctx.params.songmid || '');
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
	const fileInfo = fileType[quality] || fileType[128];
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
			.then(async res => {
				const response = res.data;
				const missing = get(response, 'req_0.data.midurlinfo', []).filter(item => !item.purl);
				const previews = {};
				if (missing.length && ctx.query.preview !== '0') {
					const previewData = JSON.parse(JSON.stringify(data));
					previewData.req_0.param.songmid = missing.map(item => item.songmid);
					previewData.req_0.param.songtype = missing.map(() => 0);
					previewData.req_0.param.filename = missing.map(item => `RS02${item.songmid}${item.songmid}.mp3`);
					try {
						const result = await UCommon({ ...props, params: { format: 'json', data: JSON.stringify(previewData) } });
						for (const item of get(result.data, 'req_0.data.midurlinfo', [])) {
							if (item.purl) previews[item.songmid] = { item, domain: get(result.data, 'req_0.data.sip[0]') };
						}
					} catch { /* Preview is only available when issued by QQ Music. */ }
				}
				const domain = get(response, 'req_0.data.sip', [])
					.find(i => !i.startsWith('http://ws'))
					|| get(response, 'req_0.data.sip[0]');

				let playUrl = {};
				get(response, 'req_0.data.midurlinfo', []).forEach((item) => {
					const preview = previews[item.songmid];
					const hasUrl = !!item.purl || !!preview;
					playUrl[item.songmid] = {
						url: preview ? `${preview.domain}${preview.item.purl}` : hasUrl ? `${domain}${item.purl}` : '',
						isPreview: !!preview || /RS02/.test(item.purl || ''),
						previewLimit: preview ? 30 : undefined,
						result: item.result,
						error: !hasUrl && (
							loginflag ? '当前账号未获得完整播放授权，且平台未提供试听片段；可能需要单独购买或重新登录' : '平台未提供游客试听片段，请登录后重试'
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

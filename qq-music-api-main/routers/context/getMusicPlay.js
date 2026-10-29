const { UCommon } = require('../../module');
const { _guid } = require('../../module/config');
const get = require('lodash.get');
const axios = require('axios');
// A vkey response may issue a path for a nonexistent preview file.
async function validPreview(domains, path) {
	if (!domains.length) domains = ['https://isure.stream.qqmusic.qq.com/'];
	for (const domain of domains.slice(0, 2)) {
		try {
			const url = `${domain}${path}`.replace(/^http:/, 'https:');
			const response = await axios.get(url, { headers: { Range: 'bytes=0-255', Referer: 'https://y.qq.com/' }, responseType: 'arraybuffer', timeout: 3500, maxContentLength: 65536 });
			const bytes = Buffer.from(response.data);
			if (bytes.toString('ascii', 0, 3) === 'ID3' || bytes.toString('ascii', 4, 8) === 'ftyp' || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return url;
		} catch { /* Try another CDN supplied by the platform. */ }
	}
	return '';
}
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
					for (const track of missing) {
						try {
							const detail = await UCommon({ ...props, params: { format: 'json', data: JSON.stringify({ songinfo: { module: 'music.pf_song_detail_svr', method: 'get_song_detail_yqq', param: { song_mid: track.songmid, song_type: 0 } } }) } });
							const media = get(detail.data, 'songinfo.data.track_info.file.media_mid');
							if (!media || !/^[a-zA-Z0-9]+$/.test(media)) continue;
							for (const filename of [`RS02${media}.mp3`, `C400${media}.m4a`]) {
								const query = { req_0: { module: 'music.vkey.GetVkey', method: 'UrlGetVkey', param: { filename: [filename], songmid: [track.songmid], songtype: [0], guid, uin, ctx: 0 } }, comm: data.comm };
								const result = await UCommon({ ...props, params: { format: 'json', data: JSON.stringify(query) } });
								const item = get(result.data, 'req_0.data.midurlinfo[0]');
								if (!item?.purl || item.result) continue;
								const url = await validPreview(get(result.data, 'req_0.data.sip', []), item.purl);
								if (url) { previews[track.songmid] = { item, url }; break; }
							}
						} catch { /* Fall back to the older endpoint only when needed. */ }
					}
					const previewData = JSON.parse(JSON.stringify(data));
					previewData.req_0.param.songmid = missing.map(item => item.songmid);
					previewData.req_0.param.songtype = missing.map(() => 0);
					previewData.req_0.param.filename = missing.map(item => `RS02${item.songmid}${item.songmid}.mp3`);
					try {
						const result = await UCommon({ ...props, params: { format: 'json', data: JSON.stringify(previewData) } });
						for (const item of get(result.data, 'req_0.data.midurlinfo', [])) {
							if (item.purl && !previews[item.songmid]) {
								const url = await validPreview(get(result.data, 'req_0.data.sip', []), item.purl);
								if (url) previews[item.songmid] = { item, url };
							}
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
						url: preview ? preview.url : hasUrl ? `${domain}${item.purl}`.replace(/^http:/, 'https:') : '',
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

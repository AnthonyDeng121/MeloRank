const { getLyric } = require('../../module');
const { UCommon } = require('../../module');
const { decodeLyric } = require('../../util/lyricDecode');

// songmid=003rJSwm3TechU
module.exports = async (ctx, next) => {
	const { songmid, isFormat } = ctx.query;
	const props = {
		method: 'get',
		params: {
			songmid,
		},
		option: {},
		isFormat,
	};
	if (songmid) {
		try {
			const result = await UCommon({ params: { format: 'json', data: JSON.stringify({
				comm: { ct: 24, cv: 0 },
				req: { module: 'music.musichallSong.PlayLyricInfo', method: 'GetPlayLyricInfo', param: {
					songMid: songmid, crypt: 0, qrc: 0, trans: 1, roma: 1, type: 1,
				} },
			}) } });
			const data = result.data?.req?.data;
			if (data && result.data.req.code === 0) {
				const lyric = decodeLyric(data.lyric);
				if (lyric) {
					ctx.status = 200;
					ctx.body = { response: { lyric, trans: decodeLyric(data.trans), roma: decodeLyric(data.roma) } };
					return;
				}
			}
		} catch (error) { console.warn('Extended lyrics unavailable:', error.message); }
		const { status, body } = await getLyric(props);
		if (body?.response) {
			body.response.trans = decodeLyric(body.response.trans);
			body.response.roma = decodeLyric(body.response.roma);
		}
		Object.assign(ctx, {
			status,
			body,
		});
	} else {
		ctx.status = 400;
		ctx.body = {
			response: 'no songmid',
		};
	}
};

const { getSearchByKey } = require('../../module');

// w：搜索关键字
// p：当前页
// n：每页歌曲数量
// catZhida: 0表示歌曲, 2表示歌手, 3表示专辑, 4, 5
module.exports = async (ctx, next) => {
	// 同时支持w和key参数，兼容前端修改
	const { w: w1, key: w2, limit: n, page: p, catZhida, remoteplace = 'song' } = ctx.query;
	const w = w1 || w2;
	const props = {
		method: 'get',
		params: {
			w,
			n: +n || 10,
			p: +p || 1,
			catZhida: +catZhida || 0,
			remoteplace: `txt.yqq.${remoteplace}`,
		},
		option: {},
	};
	if (w) {
		try {
			const result = await getSearchByKey(props);
			// 确保status存在且是数字
			ctx.status = result.status || 500;
			ctx.body = result.body;
		} catch (error) {
			ctx.status = 500;
			ctx.body = {
				error: error.message || 'Internal server error'
			};
		}
	} else {
		ctx.status = 400;
		ctx.body = {
			response: 'search key is null',
		};
	}
};

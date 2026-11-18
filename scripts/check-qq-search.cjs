const assert = require('node:assert/strict');
const search = require('../qq-music-api-main/module/apis/search/getSearchByKey');
const { requestAuth } = require('../qq-music-api-main/util/requestAuth');
const original = global.fetch;
(async () => {
  try {
    for (const [catZhida, type, group] of [[0, 0, 'song'], [2, 1, 'singer'], [3, 2, 'album']]) {
      global.fetch = async (url, options) => {
        const payload = JSON.parse(new URL(url).searchParams.get('data'));
        assert.deepEqual(Object.keys(payload), ['music.search.SearchCgiService']);
        assert.deepEqual(payload['music.search.SearchCgiService'].param, { query: 'Lady Gaga', search_type: type, page_num: 2, num_per_page: 10 });
        assert.equal(options.headers.Cookie, 'fixture=request-only');
        return { ok: true, json: async () => ({ code: 0, 'music.search.SearchCgiService': { code: 0, data: { body: { [group]: { list: [{ mid: 'fixture', name: 'Title', album: { mid: 'album', name: 'Album' } }] } }, meta: { sum: 27, curpage: 2 } } } }) };
      };
      const response = await requestAuth.run({ cookie: 'fixture=request-only' }, () => search({ params: { catZhida, w: 'Lady Gaga', n: 10, p: 2 } }));
      assert.equal(response.status, 200); assert.equal(response.body.response.data[group].totalnum, 27);
      if (type === 0) assert.equal(response.body.response.data.song.list[0].songmid, 'fixture');
    }
    global.fetch = async () => ({ ok: true, json: async () => ({ code: 1 }) });
    assert.equal((await search({ params: { w: 'query' } })).status, 502);
    console.log('PASS QQ typed search envelope, pagination, request-scoped authentication, song normalization and upstream errors');
  } finally { global.fetch = original; }
})().catch(error => { console.error(error); process.exitCode = 1; });

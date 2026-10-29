const { requestAuth } = require('./requestAuth');
module.exports = () => async (ctx, next) => {
  const cookie = ctx.get('X-QQ-Music-Cookie') || '';
  ctx.request.cookie = cookie;
  await requestAuth.run({ cookie }, next);
};

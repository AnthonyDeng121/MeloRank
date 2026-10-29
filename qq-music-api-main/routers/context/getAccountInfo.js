// The QR callback carries the nickname of the account that scanned.
const { getUin } = require('../../util/requestAuth');
module.exports = async ctx => {
  const uin = getUin(ctx.request.cookie);
  ctx.status = uin === '0' ? 401 : 200;
  ctx.body = { body: { uin, nickname: '' } };
};

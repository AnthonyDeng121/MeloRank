// The QR callback carries the nickname of the account that scanned.
module.exports = async ctx => {
  ctx.body = { status: 200, body: { nickname: global.userInfo?.nickname || '' } };
};

const { AsyncLocalStorage } = require('node:async_hooks');
const requestAuth = new AsyncLocalStorage();
const resolveCookie = explicit => explicit != null ? explicit : requestAuth.getStore()?.cookie || '';
const getUin = cookie => /(?:^|;\s*)(?:uin|qqmusic_uin|musicid|wxuin)=([^;]+)/.exec(cookie || '')?.[1]?.replace(/^o(?=\d)/, '') || '0';
module.exports = { requestAuth, resolveCookie, getUin };

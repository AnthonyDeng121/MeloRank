const sessions = new Map();
const origins = new Set(['http://127.0.0.1:5188', 'http://localhost:5188']);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.frameId !== 0 || !sender.tab?.id) return;
  let url;
  try { url = new URL(sender.url); } catch { return; }
  if (!origins.has(url.origin) || message?.type !== 'melorank-netease') return;
  (async () => {
    const tabId = sender.tab.id;
    for (const [id, expiry] of sessions) if (expiry < Date.now()) sessions.delete(id);
    if (message.action === 'begin') {
      sessions.set(tabId, Date.now() + 180000);
      try { await chrome.tabs.create({ url: 'https://music.163.com/#/login' }); }
      catch { sessions.delete(tabId); throw new Error('无法打开网易云官网'); }
      return { ok: true };
    }
    if (message.action === 'cancel') { sessions.delete(tabId); return { ok: true }; }
    if (message.action !== 'read' || !sessions.has(tabId)) throw new Error('连接已过期，请重新点击自动连接');
    const all = await chrome.cookies.getAll({ url: 'https://music.163.com/' });
    const allowed = ['MUSIC_U', '__csrf', 'NMTID', 'MUSIC_A'];
    const chosen = allowed.map(name => all.find(cookie => cookie.name === name && cookie.value)).filter(Boolean);
    if (!chosen.some(cookie => cookie.name === 'MUSIC_U')) return { ok: true, waiting: true };
    sessions.delete(tabId);
    await chrome.tabs.update(tabId, { active: true });
    return { ok: true, cookie: chosen.map(({ name, value }) => `${name}=${value}`).join('; ') + ';' };
  })().then(respond, () => respond({ ok: false, error: '自动连接未完成，请重新点击或使用手动导入' }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => sessions.delete(tabId));

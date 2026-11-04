(() => {
  if (!['http://127.0.0.1:5188', 'http://localhost:5188'].includes(location.origin) || window !== window.top) return;
  window.addEventListener('message', async event => {
    const request = event.data;
    if (event.source !== window || event.origin !== location.origin || request?.type !== 'MELORANK_NETEASE_REQUEST' ||
      typeof request.id !== 'string' || request.id.length > 80 || !['begin', 'read', 'cancel'].includes(request.action)) return;
    let result;
    try { result = await chrome.runtime.sendMessage({ type: 'melorank-netease', action: request.action }); }
    catch { result = { ok: false, error: '扩展已失效，请刷新 MeloRank 页面' }; }
    window.postMessage({ type: 'MELORANK_NETEASE_RESPONSE', id: request.id, result }, location.origin);
  });
})();

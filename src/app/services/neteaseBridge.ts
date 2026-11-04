interface BridgeResult { ok: boolean; cookie?: string; waiting?: boolean; error?: string }
export function requestNeteaseBridge(action: 'begin' | 'read' | 'cancel', signal?: AbortSignal): Promise<BridgeResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('已取消', 'AbortError')); return; }
    const id = crypto.randomUUID();
    const clean = () => { window.removeEventListener('message', receive); clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(new DOMException('已取消', 'AbortError')); };
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'MELORANK_NETEASE_RESPONSE' || event.data.id !== id) return;
      clean();
      const result = event.data.result as BridgeResult;
      if (!result?.ok) reject(new Error(result?.error || '扩展未返回有效结果')); else resolve(result);
    };
    const timer = setTimeout(() => { clean(); reject(new Error('未检测到登录助手扩展，请安装扩展并刷新页面后重试')); }, 5000);
    window.addEventListener('message', receive);
    signal?.addEventListener('abort', abort, { once: true });
    window.postMessage({ type: 'MELORANK_NETEASE_REQUEST', id, action }, location.origin);
  });
}

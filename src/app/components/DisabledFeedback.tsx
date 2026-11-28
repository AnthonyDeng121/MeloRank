import { useEffect, useState } from 'react';

// Native disabled controls cannot receive focus. Keep them disabled while exposing
// their explanation to pointer users; explicit reasons also become native titles.
export function DisabledFeedback() {
  const [hint, setHint] = useState<{ text: string; busy: boolean; x: number; y: number } | null>(null);
  useEffect(() => {
    let target: HTMLElement | null = null;
    const originalTitles = new Map<HTMLElement, string | null>();
    const busy = (node: HTMLElement) => node.getAttribute('aria-busy') === 'true' || /正在|请稍候|请等待|读取|加载/.test(node.dataset.disabledReason || node.textContent || '');
    const explain = (node: HTMLElement) => node.dataset.disabledReason || (busy(node) ? '正在处理，请等待当前任务完成' : '当前操作不可用，请先完成所需内容');
    const sync = () => {
      document.querySelectorAll<HTMLElement>(':disabled,[aria-disabled="true"]').forEach(node => {
        if (!originalTitles.has(node)) originalTitles.set(node, node.getAttribute('title'));
        node.classList.toggle('control-waiting', busy(node));
        const reason = explain(node);
        if (node.title !== reason) node.title = reason;
      });
      for (const [node, title] of originalTitles) {
        if (!node.isConnected || !node.matches(':disabled,[aria-disabled="true"]')) {
          if (title === null) node.removeAttribute('title'); else node.title = title;
          node.classList.remove('control-waiting');
          originalTitles.delete(node);
        }
      }
      if (target && (!target.isConnected || !target.matches(':disabled,[aria-disabled="true"]'))) { target = null; setHint(null); }
    };
    const move = (event: PointerEvent) => {
      target = (event.target as HTMLElement)?.closest<HTMLElement>(':disabled,[aria-disabled="true"]');
      setHint(target ? { text: explain(target), busy: busy(target), x: Math.min(event.clientX + 12, innerWidth - 320), y: Math.min(event.clientY + 20, innerHeight - 70) } : null);
    };
    const clear = () => { target = null; setHint(null); };
    const observer = new MutationObserver(sync);
    sync(); observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'data-disabled-reason'] });
    document.addEventListener('pointermove', move, true); document.addEventListener('scroll', clear, true); document.addEventListener('pointerleave', clear);
    return () => { observer.disconnect(); document.removeEventListener('pointermove', move, true); document.removeEventListener('scroll', clear, true); document.removeEventListener('pointerleave', clear); };
  }, []);
  return hint && <div className="disabled-reason-tooltip" role="tooltip" style={{ left: Math.max(8, hint.x), top: hint.y }}><span aria-hidden="true">{hint.busy ? '◷' : '⊘'}</span> {hint.text}</div>;
}

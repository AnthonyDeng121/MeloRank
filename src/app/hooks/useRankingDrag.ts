import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { reorderPlaylist } from '../utils/playlistRanking';

export function useRankingDrag<T extends { id: string }>(items: T[], save: (items: T[]) => void) {
  const [preview, setPreview] = useState<T[] | null>(null), [activeId, setActiveId] = useState<string | null>(null);
  const values = useRef(items), update = useRef(save), draft = useRef<T[]>([]);
  values.current = items; update.current = save;
  const session = useRef<{ id: string; pointerId: number; x: number; y: number; active: boolean; snapshot: T[] } | null>(null);
  const point = useRef({ x: 0, y: 0 }), suppress = useRef(false);
  useEffect(() => {
    let frame = 0, previousSelect = '';
    const hover = () => {
      const current = session.current; if (!current?.active) return;
      const target = document.elementFromPoint(point.current.x, point.current.y)?.closest<HTMLElement>('[data-ranking-drag]')?.dataset.rankingDrag;
      if (target) { const next = reorderPlaylist(draft.current, current.id, target); if (next !== draft.current) { draft.current = next; setPreview(next); } }
    };
    const scroll = () => {
      if (!session.current?.active) return;
      const y = point.current.y, delta = y < 90 ? -Math.min(18, (90 - y) / 4) : y > innerHeight - 90 ? Math.min(18, (y - innerHeight + 90) / 4) : 0;
      if (delta) { window.scrollBy(0, delta); hover(); }
      frame = requestAnimationFrame(scroll);
    };
    const finish = (commit: boolean) => {
      const current = session.current; if (!current) return;
      session.current = null; cancelAnimationFrame(frame);
      if (current.active) {
        document.body.style.userSelect = previousSelect; suppress.current = true;
        setTimeout(() => { suppress.current = false; }, 0);
        // An external edit during a drag invalidates the draft instead of losing it.
        const unchanged = values.current.length === current.snapshot.length && values.current.every((value, index) => value === current.snapshot[index]);
        if (commit && unchanged && draft.current.some((value, index) => value.id !== current.snapshot[index]?.id)) update.current(draft.current);
      }
      setPreview(null); setActiveId(null);
    };
    const move = (event: PointerEvent) => {
      const current = session.current; if (!current || current.pointerId !== event.pointerId) return;
      point.current = { x: event.clientX, y: event.clientY };
      if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 6) {
        current.active = true; draft.current = [...current.snapshot]; previousSelect = document.body.style.userSelect;
        document.body.style.userSelect = 'none'; setActiveId(current.id); setPreview(draft.current); frame = requestAnimationFrame(scroll);
      }
      hover();
    };
    const up = (event: PointerEvent) => { if (session.current?.pointerId === event.pointerId) finish(true); };
    const cancel = (event: PointerEvent) => { if (session.current?.pointerId === event.pointerId) finish(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') finish(false); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key);
    return () => { if (session.current?.active) document.body.style.userSelect = previousSelect; session.current = null; cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); };
  }, []);
  const bind = (id: string) => ({
    'data-ranking-drag': id, tabIndex: 0,
    onDragStart: (event: React.DragEvent) => event.preventDefault(),
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || session.current || (event.target as HTMLElement).closest('button, input, textarea, select, a')) return;
      // Touch users can scroll content, and drag from the rank/cover grip.
      if (event.pointerType === 'touch' && !(event.target as HTMLElement).closest('.user-rank-number, .user-rank-cover')) return;
      point.current = { x: event.clientX, y: event.clientY };
      session.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, active: false, snapshot: values.current };
    },
    onClickCapture: (event: React.MouseEvent) => { if (suppress.current) { event.preventDefault(); event.stopPropagation(); } },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || !event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const index = values.current.findIndex(item => item.id === id), target = values.current[index + (event.key === 'ArrowUp' ? -1 : 1)];
      if (target) update.current(reorderPlaylist(values.current, id, target.id));
    },
  });
  return { items: preview || items, activeId, bind };
}

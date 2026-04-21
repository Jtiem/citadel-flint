/**
 * ResizeHandle — src/components/ui/ResizeHandle.tsx
 *
 * A 4px wide vertical drag handle placed between panels.
 * Tracks mousemove via document listeners rather than React state per pixel,
 * using a ref to accumulate raw delta before committing to the parent via
 * requestAnimationFrame to keep the hot path off the React scheduler.
 *
 * Mithril Safety: all classes from Flint design token palette only.
 */

import { useRef, useCallback } from 'react';
interface ResizeHandleProps {
  /** Called with the signed pixel delta on every animation frame during drag. */
  onDrag: (delta: number) => void;
  /** Called on double-click — used for panel collapse/expand toggle (GLASS.3.2). */
  onDoubleClick?: () => void;
}
export function ResizeHandle({
  onDrag,
  onDoubleClick
}: ResizeHandleProps) {
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const rafId = useRef<number | null>(null);
  const pendingDelta = useRef(0);
  const barRef = useRef<HTMLDivElement>(null);
  const flush = useCallback(() => {
    rafId.current = null;
    if (pendingDelta.current !== 0) {
      onDrag(pendingDelta.current);
      pendingDelta.current = 0;
    }
  }, [onDrag]);
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const delta = e.clientX - lastX.current;
    lastX.current = e.clientX;
    pendingDelta.current += delta;
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(flush);
    }
  }, [flush]);
  const onMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
      if (pendingDelta.current !== 0) {
        onDrag(pendingDelta.current);
        pendingDelta.current = 0;
      }
    }
    if (barRef.current) {
      barRef.current.setAttribute('data-dragging', 'false');
    }
  }, [onMouseMove, onDrag]);
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDragging.current = true;
    lastX.current = e.clientX;
    pendingDelta.current = 0;
    // Suppress text selection and enforce resize cursor across entire window
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    if (barRef.current) {
      barRef.current.setAttribute('data-dragging', 'true');
    }
  }, [onMouseMove, onMouseUp]);
  return <div ref={barRef} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} role="separator" aria-orientation="vertical" aria-label="Resize panel" className={['group', 'relative z-10', 'flex shrink-0 cursor-col-resize items-center justify-center', 'w-6',
  // 24px — meets WCAG 2.5.5 minimum touch target (W-23)
  'self-stretch', 'bg-transparent', 'transition-colors duration-100'].join(' ')}>
            {/* Narrow 4px visual bar centered inside the 24px hit area */}
            <div className={['w-px h-full', 'bg-transparent', 'transition-colors duration-100', 'group-hover:bg-indigo-500/20', 'group-data-[dragging=true]:bg-indigo-500/30'].join(' ')} />
        </div>;
}
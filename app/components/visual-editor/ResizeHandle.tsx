/**
 * Resize Handle Component
 * Individual resize handle with correct cursor styles
 * Uses pointer events with capture for smooth tracking
 */

import React from 'react';

type HandlePosition = 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br';

interface ResizeHandleProps {
  position: HandlePosition;
  onMouseDown: (e: React.MouseEvent) => void;
}

const HANDLE_SIZE = 10;
const HANDLE_OFFSET = -HANDLE_SIZE / 2;

const CURSOR_MAP: Record<HandlePosition, string> = {
  tl: 'nwse-resize',
  t: 'ns-resize',
  tr: 'nesw-resize',
  l: 'ew-resize',
  r: 'ew-resize',
  bl: 'nesw-resize',
  b: 'ns-resize',
  br: 'nwse-resize',
};

const POSITION_STYLES: Record<HandlePosition, React.CSSProperties> = {
  tl: { top: HANDLE_OFFSET, left: HANDLE_OFFSET },
  t: { top: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' },
  tr: { top: HANDLE_OFFSET, right: HANDLE_OFFSET },
  l: { top: '50%', left: HANDLE_OFFSET, transform: 'translateY(-50%)' },
  r: { top: '50%', right: HANDLE_OFFSET, transform: 'translateY(-50%)' },
  bl: { bottom: HANDLE_OFFSET, left: HANDLE_OFFSET },
  b: { bottom: HANDLE_OFFSET, left: '50%', transform: 'translateX(-50%)' },
  br: { bottom: HANDLE_OFFSET, right: HANDLE_OFFSET },
};

export function ResizeHandle({ position, onMouseDown }: ResizeHandleProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    // Capture pointer for smooth tracking even when cursor moves fast
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // Call the parent's handler with the event cast to MouseEvent-like
    onMouseDown(e as unknown as React.MouseEvent);
  };

  return (
    <div
      className="absolute bg-white border-2 border-blue-500 rounded-full"
      style={{
        width: `${HANDLE_SIZE}px`,
        height: `${HANDLE_SIZE}px`,
        cursor: CURSOR_MAP[position],
        pointerEvents: 'auto',
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        touchAction: 'none', // Prevent browser touch gestures
        ...POSITION_STYLES[position],
      }}
      onPointerDown={handlePointerDown}
    />
  );
}

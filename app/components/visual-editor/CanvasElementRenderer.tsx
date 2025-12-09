/**
 * Canvas Element Renderer
 * Renders individual canvas elements with drag/resize/rotate handles
 */

import React, { useRef } from 'react';
import { visualEditorActions } from '~/lib/stores/visual-editor';
import { syncCanvasToDOM } from '~/lib/visual-editor/dom-to-canvas';
import type { CanvasElement } from '~/lib/visual-editor/types';
import { ResizeHandle } from './ResizeHandle';

interface CanvasElementRendererProps {
  element: CanvasElement;
  isSelected: boolean;
  isHovered: boolean;
  onTransformStart: (type: 'drag' | 'resize' | 'rotate', handle?: string) => void;
  iframeRef: React.RefObject<HTMLIFrameElement>;
}

export function CanvasElementRenderer({
  element,
  isSelected,
  isHovered,
  onTransformStart,
  iframeRef,
}: CanvasElementRendererProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  // Handle element click (selection)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const multiSelect = e.metaKey || e.ctrlKey;
    visualEditorActions.selectElement(element.id, multiSelect);
  };

  // Handle drag start with pointer capture for smooth tracking
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) {
      return;
    } // Only left click

    e.stopPropagation();

    // Capture pointer for smooth tracking
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    visualEditorActions.startTransform('drag', element.id, e.clientX, e.clientY);
    onTransformStart('drag');
  };

  // Handle resize start
  const handleResizeStart = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();

    visualEditorActions.startTransform('resize', element.id, e.clientX, e.clientY, handle as any);
    onTransformStart('resize', handle);
  };

  // Handle rotate start
  const handleRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation();

    visualEditorActions.startTransform('rotate', element.id, e.clientX, e.clientY);
    onTransformStart('rotate');
  };

  // Sync changes to iframe DOM
  React.useEffect(() => {
    if (iframeRef.current?.contentWindow && element.domInfo) {
      syncCanvasToDOM(element, iframeRef.current.contentWindow);
    }
  }, [element.x, element.y, element.width, element.height, element.rotation, element.opacity]);

  const showHandles = isSelected;
  const showOutline = isSelected || isHovered;

  return (
    <div
      ref={elementRef}
      className="absolute"
      style={{
        left: `${element.x}px`,
        top: `${element.y}px`,
        width: `${element.width}px`,
        height: `${element.height}px`,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: 'auto',
        cursor: 'move',
        touchAction: 'none', // Prevent browser touch gestures for smooth dragging
      }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
    >
      {/* Selection outline */}
      {showOutline && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            border: `2px solid ${isSelected ? '#3b82f6' : '#10b981'}`,
            borderRadius: `${element.borderRadius || 0}px`,
          }}
        />
      )}

      {/* Resize handles */}
      {showHandles && (
        <>
          <ResizeHandle position="tl" onMouseDown={(e) => handleResizeStart('tl', e)} />
          <ResizeHandle position="t" onMouseDown={(e) => handleResizeStart('t', e)} />
          <ResizeHandle position="tr" onMouseDown={(e) => handleResizeStart('tr', e)} />
          <ResizeHandle position="l" onMouseDown={(e) => handleResizeStart('l', e)} />
          <ResizeHandle position="r" onMouseDown={(e) => handleResizeStart('r', e)} />
          <ResizeHandle position="bl" onMouseDown={(e) => handleResizeStart('bl', e)} />
          <ResizeHandle position="b" onMouseDown={(e) => handleResizeStart('b', e)} />
          <ResizeHandle position="br" onMouseDown={(e) => handleResizeStart('br', e)} />

          {/* Rotation handle */}
          <div
            className="absolute"
            style={{
              left: '50%',
              top: '-30px',
              transform: 'translateX(-50%)',
              cursor: 'grab',
            }}
            onMouseDown={handleRotateStart}
          >
            <div
              className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white"
              style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
            />
            <div className="absolute left-1/2 top-3 w-0.5 h-6 bg-blue-500" style={{ transform: 'translateX(-50%)' }} />
          </div>
        </>
      )}

      {/* Element info overlay (for debugging) */}
      {isSelected && (
        <div
          className="absolute -top-6 left-0 text-xs bg-blue-500 text-white px-2 py-1 rounded pointer-events-none"
          style={{ whiteSpace: 'nowrap' }}
        >
          {element.domInfo?.tagName || element.type} {Math.round(element.width)}×{Math.round(element.height)}
        </div>
      )}
    </div>
  );
}

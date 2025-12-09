/**
 * Canvas Overlay Component
 * Transparent overlay positioned over the iframe preview
 * Renders canvas elements and handles mouse interactions
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { visualEditorStore, visualEditorActions } from '~/lib/stores/visual-editor';
import { CanvasElementRenderer } from './CanvasElementRenderer';
import type { CanvasElement } from '~/lib/visual-editor/types';

interface CanvasOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
}

interface OverlayBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface IframeScroll {
  x: number;
  y: number;
}

export function CanvasOverlay({ iframeRef }: CanvasOverlayProps) {
  const state = useStore(visualEditorStore);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [overlayBounds, setOverlayBounds] = useState<OverlayBounds | null>(null);
  const [iframeScroll, setIframeScroll] = useState<IframeScroll>({ x: 0, y: 0 });

  // Update overlay bounds to match iframe position and size
  const updateOverlayBounds = useCallback(() => {
    if (!iframeRef.current || !overlayRef.current) return;

    const iframe = iframeRef.current;
    const overlay = overlayRef.current;

    // Get the closest positioned ancestor of the overlay
    const positionedAncestor = overlay.offsetParent as HTMLElement | null;
    if (!positionedAncestor) return;

    const ancestorRect = positionedAncestor.getBoundingClientRect();
    const iframeRect = iframe.getBoundingClientRect();

    // Calculate iframe position relative to the positioned ancestor
    setOverlayBounds({
      left: iframeRect.left - ancestorRect.left,
      top: iframeRect.top - ancestorRect.top,
      width: iframeRect.width,
      height: iframeRect.height,
    });
  }, [iframeRef]);

  // Update bounds on mount and when iframe changes
  useEffect(() => {
    // Initial update after render
    const timer = setTimeout(updateOverlayBounds, 0);

    // Set up resize observer to track iframe size changes
    const resizeObserver = new ResizeObserver(updateOverlayBounds);
    if (iframeRef.current) {
      resizeObserver.observe(iframeRef.current);
    }

    // Also listen for window resize
    window.addEventListener('resize', updateOverlayBounds);

    // Update on scroll too (in case container is scrollable)
    const container = overlayRef.current?.offsetParent;
    if (container) {
      container.addEventListener('scroll', updateOverlayBounds);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateOverlayBounds);
      if (container) {
        container.removeEventListener('scroll', updateOverlayBounds);
      }
    };
  }, [iframeRef, updateOverlayBounds]);

  // Listen for iframe scroll events via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'VISUAL_EDITOR_SCROLL') {
        setIframeScroll({
          x: event.data.scrollX || 0,
          y: event.data.scrollY || 0,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle pointer events for transform operations
  // Using pointer events for better touch support and smoother tracking
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!state.transform.type || !isTransforming) {
        return;
      }

      // Use viewport coordinates (clientX/clientY) directly
      // This matches the coordinates stored in startTransform
      visualEditorActions.updateTransform(e.clientX, e.clientY);
    };

    const handlePointerUp = () => {
      if (isTransforming) {
        visualEditorActions.endTransform();
        setIsTransforming(false);
      }
    };

    if (isTransforming) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);

      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isTransforming, state.transform.type]);

  // Handle canvas background click (deselect)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      visualEditorActions.clearSelection();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selection.selectedElementIds.length > 0) {
        e.preventDefault();
        state.selection.selectedElementIds.forEach((id) => {
          visualEditorActions.deleteElement(id);
        });
      }

      // Undo/Redo
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          visualEditorActions.undo();
        } else if (e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          visualEditorActions.redo();
        }
      }

      // Arrow key nudging
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        state.selection.selectedElementIds.length > 0
      ) {
        e.preventDefault();
        const delta = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0;
        const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0;

        state.selection.selectedElementIds.forEach((id) => {
          const element = state.canvasElements.find((el) => el.id === id);
          if (element) {
            visualEditorActions.updateElement(id, {
              x: element.x + dx,
              y: element.y + dy,
            });
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selection.selectedElementIds, state.canvasElements]);

  if (!state.isActive) {
    return null;
  }

  // Use calculated bounds or fall back to full container
  const overlayStyle: React.CSSProperties = overlayBounds
    ? {
        position: 'absolute',
        left: `${overlayBounds.left}px`,
        top: `${overlayBounds.top}px`,
        width: `${overlayBounds.width}px`,
        height: `${overlayBounds.height}px`,
        zIndex: 1000,
        cursor: isTransforming ? 'grabbing' : 'default',
        pointerEvents: 'none',
        overflow: 'hidden',
      }
    : {
        position: 'absolute',
        inset: 0,
        zIndex: 1000,
        cursor: isTransforming ? 'grabbing' : 'default',
        pointerEvents: 'none',
      };

  return (
    <div
      ref={overlayRef}
      style={overlayStyle}
      onClick={handleCanvasClick}
    >
      {/* Inner container that scrolls with iframe content */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${-iframeScroll.x}px, ${-iframeScroll.y}px)`,
          willChange: 'transform',
        }}
      >
        {/* Render all canvas elements */}
        {state.canvasElements.map((element) => {
          const isSelected = state.selection.selectedElementIds.includes(element.id);
          const isHovered = state.selection.hoveredElementId === element.id;

          return (
            <CanvasElementRenderer
              key={element.id}
              element={element}
              isSelected={isSelected}
              isHovered={isHovered}
              onTransformStart={(type, handle) => {
                setIsTransforming(true);
              }}
              iframeRef={iframeRef}
            />
          );
        })}
      </div>
    </div>
  );
}

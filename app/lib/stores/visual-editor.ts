/**
 * Visual Editor Store
 * Central state management for the canvas-based visual editor
 */

import { atom, map } from 'nanostores';
import type {
  CanvasElement,
  VisualEditorState,
  SelectionState,
  TransformState,
  StyleChange,
} from '../visual-editor/types';

// Main visual editor state
export const visualEditorStore = map<VisualEditorState>({
  isActive: false,
  canvasElements: [],
  selection: {
    selectedElementIds: [],
    hoveredElementId: null,
  },
  transform: {
    type: null,
    elementId: null,
    startX: 0,
    startY: 0,
    startElement: null,
  },
  history: {
    past: [],
    future: [],
  },
});

// Style changes tracking (for code generation)
export const styleChangesStore = atom<StyleChange[]>([]);

/**
 * Actions
 */

export const visualEditorActions = {
  /**
   * Activate/deactivate design mode
   */
  setActive(active: boolean) {
    visualEditorStore.setKey('isActive', active);

    if (!active) {
      // Clear state when exiting design mode
      visualEditorStore.setKey('canvasElements', []);
      visualEditorStore.setKey('selection', {
        selectedElementIds: [],
        hoveredElementId: null,
      });
      styleChangesStore.set([]);
    }
  },

  /**
   * Get a canvas element by ID
   */
  getElement(id: string): CanvasElement | undefined {
    const current = visualEditorStore.get();
    return current.canvasElements.find((el) => el.id === id);
  },

  /**
   * Add a canvas element
   */
  addElement(element: CanvasElement) {
    const current = visualEditorStore.get();
    const newElements = [...current.canvasElements, element];

    // Save to history
    const newHistory = {
      past: [...current.history.past, current.canvasElements],
      future: [],
    };

    visualEditorStore.setKey('canvasElements', newElements);
    visualEditorStore.setKey('history', newHistory);
  },

  /**
   * Update an existing canvas element
   */
  updateElement(id: string, updates: Partial<CanvasElement>) {
    const current = visualEditorStore.get();
    const newElements = current.canvasElements.map((el) => (el.id === id ? { ...el, ...updates } : el));

    visualEditorStore.setKey('canvasElements', newElements);
  },

  /**
   * Delete a canvas element
   */
  deleteElement(id: string) {
    const current = visualEditorStore.get();
    const newElements = current.canvasElements.filter((el) => el.id !== id);

    // Save to history
    const newHistory = {
      past: [...current.history.past, current.canvasElements],
      future: [],
    };

    visualEditorStore.setKey('canvasElements', newElements);
    visualEditorStore.setKey('history', newHistory);

    // Deselect if it was selected
    const newSelection = {
      ...current.selection,
      selectedElementIds: current.selection.selectedElementIds.filter((selId) => selId !== id),
    };

    visualEditorStore.setKey('selection', newSelection);
  },

  /**
   * Select element(s)
   */
  selectElement(id: string, multi: boolean = false) {
    const current = visualEditorStore.get();
    let newSelectedIds: string[];

    if (multi) {
      // Add to selection if not already selected, remove if already selected
      newSelectedIds = current.selection.selectedElementIds.includes(id)
        ? current.selection.selectedElementIds.filter((selId) => selId !== id)
        : [...current.selection.selectedElementIds, id];
    } else {
      // Single selection
      newSelectedIds = [id];
    }

    visualEditorStore.setKey('selection', {
      ...current.selection,
      selectedElementIds: newSelectedIds,
    });
  },

  /**
   * Clear selection
   */
  clearSelection() {
    const current = visualEditorStore.get();

    visualEditorStore.setKey('selection', {
      ...current.selection,
      selectedElementIds: [],
    });
  },

  /**
   * Set hovered element
   */
  setHovered(id: string | null) {
    const current = visualEditorStore.get();

    visualEditorStore.setKey('selection', {
      ...current.selection,
      hoveredElementId: id,
    });
  },

  /**
   * Start transform operation
   */
  startTransform(
    type: 'drag' | 'resize' | 'rotate',
    elementId: string,
    startX: number,
    startY: number,
    resizeHandle?: TransformState['resizeHandle'],
  ) {
    const current = visualEditorStore.get();
    const element = current.canvasElements.find((el) => el.id === elementId);

    if (!element) {
      return;
    }

    visualEditorStore.setKey('transform', {
      type,
      elementId,
      startX,
      startY,
      startElement: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
      },
      resizeHandle,
    });
  },

  /**
   * Update transform operation using incremental deltas
   * This approach updates startX/startY after each move for smoother tracking
   */
  updateTransform(currentX: number, currentY: number) {
    const current = visualEditorStore.get();
    const { transform } = current;

    if (!transform.type || !transform.elementId || !transform.startElement) {
      return;
    }

    const element = current.canvasElements.find((el) => el.id === transform.elementId);

    if (!element) {
      return;
    }

    // Calculate incremental delta from last position
    const dx = currentX - transform.startX;
    const dy = currentY - transform.startY;

    let updates: Partial<CanvasElement> = {};

    if (transform.type === 'drag') {
      // Simple incremental move
      updates = {
        x: element.x + dx,
        y: element.y + dy,
      };
    } else if (transform.type === 'resize' && transform.resizeHandle) {
      const handle = transform.resizeHandle;
      const minSize = 20;
      let { x, y, width, height } = element;

      // 8-point resize logic using incremental deltas
      // For north (top) handles
      if (handle.includes('t')) {
        const newHeight = Math.max(minSize, height - dy);
        y += height - newHeight;
        height = newHeight;
      }
      // For south (bottom) handles
      if (handle.includes('b')) {
        height = Math.max(minSize, height + dy);
      }
      // For west (left) handles
      if (handle.includes('l')) {
        const newWidth = Math.max(minSize, width - dx);
        x += width - newWidth;
        width = newWidth;
      }
      // For east (right) handles
      if (handle.includes('r')) {
        width = Math.max(minSize, width + dx);
      }

      updates = { x, y, width, height };
    } else if (transform.type === 'rotate') {
      // Calculate rotation angle from center point (using current element position)
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      const angle = (Math.atan2(currentY - centerY, currentX - centerX) * 180) / Math.PI;

      updates = {
        rotation: angle + 90, // Offset to make top = 0 degrees
      };
    }

    // Update the element
    this.updateElement(transform.elementId, updates);

    // Update startX/startY for incremental delta calculation
    visualEditorStore.setKey('transform', {
      ...transform,
      startX: currentX,
      startY: currentY,
    });
  },

  /**
   * End transform operation
   */
  endTransform() {
    visualEditorStore.setKey('transform', {
      type: null,
      elementId: null,
      startX: 0,
      startY: 0,
      startElement: null,
    });
  },

  /**
   * Track a style change for code generation
   */
  trackStyleChange(elementId: string, property: string, oldValue: string, newValue: string) {
    const current = styleChangesStore.get();

    styleChangesStore.set([
      ...current,
      {
        elementId,
        property,
        oldValue,
        newValue,
        timestamp: Date.now(),
      },
    ]);
  },

  /**
   * Get all style changes
   */
  getStyleChanges(): StyleChange[] {
    return styleChangesStore.get();
  },

  /**
   * Clear style changes
   */
  clearStyleChanges() {
    styleChangesStore.set([]);
  },

  /**
   * Undo last action
   */
  undo() {
    const current = visualEditorStore.get();

    if (current.history.past.length === 0) {
      return;
    }

    const previous = current.history.past[current.history.past.length - 1];
    const newPast = current.history.past.slice(0, -1);

    visualEditorStore.setKey('canvasElements', previous);
    visualEditorStore.setKey('history', {
      past: newPast,
      future: [current.canvasElements, ...current.history.future],
    });
  },

  /**
   * Redo last undone action
   */
  redo() {
    const current = visualEditorStore.get();

    if (current.history.future.length === 0) {
      return;
    }

    const next = current.history.future[0];
    const newFuture = current.history.future.slice(1);

    visualEditorStore.setKey('canvasElements', next);
    visualEditorStore.setKey('history', {
      past: [...current.history.past, current.canvasElements],
      future: newFuture,
    });
  },
};

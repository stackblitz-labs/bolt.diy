/**
 * Visual Editor Type Definitions
 * Defines the canvas-based data structures for visual editing
 */

export enum ElementType {
  RECTANGLE = 'rectangle',
  ELLIPSE = 'ellipse',
  TEXT = 'text',
  IMAGE = 'image',
  SVG = 'svg',
  GROUP = 'group',
  DOM = 'dom', // Represents an existing DOM element
}

/**
 * Canvas Element - The core data structure for visual editing
 * Represents an element in the canvas state, independent of the actual DOM
 */
export interface CanvasElement {
  id: string; // Unique identifier (CSS selector for DOM elements)
  type: ElementType;

  // Position & Transform
  x: number; // Absolute X position in canvas
  y: number; // Absolute Y position in canvas
  width: number;
  height: number;
  rotation: number; // Degrees
  opacity: number; // 0-1

  // Visual Properties (Shape elements)
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;

  // Text Properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  textColor?: string;

  // Image Properties
  imageUrl?: string;
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // SVG Properties
  svgString?: string;

  // Group Properties
  children?: CanvasElement[];

  // DOM Bridge Properties (for existing HTML elements)
  domInfo?: DOMElementInfo;
}

/**
 * DOM Element Info - Links canvas element to actual DOM element
 * Stores information needed to sync changes back to the real DOM
 */
export interface DOMElementInfo {
  selector: string; // CSS selector to find the element
  tagName: string; // HTML tag name
  className: string; // Original class names
  elementId: string; // WeakMap ID from visual-editor-script.js

  // Original Layout Context
  originalPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Computed Styles (before editing)
  computedStyles: Record<string, string>;

  // Source Location (if known)
  sourceFile?: string;
  sourceLine?: number;
}

/**
 * Selection State
 */
export interface SelectionState {
  selectedElementIds: string[];
  hoveredElementId: string | null;
}

/**
 * Transform State - Tracks ongoing drag/resize/rotate operations
 */
export interface TransformState {
  type: 'drag' | 'resize' | 'rotate' | null;
  elementId: string | null;
  startX: number;
  startY: number;
  startElement: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  } | null;
  resizeHandle?: 'tl' | 't' | 'tr' | 'l' | 'r' | 'bl' | 'b' | 'br';
}

/**
 * Visual Editor State - Complete state for the visual editor
 */
export interface VisualEditorState {
  isActive: boolean;
  canvasElements: CanvasElement[];
  selection: SelectionState;
  transform: TransformState;
  history: {
    past: CanvasElement[][];
    future: CanvasElement[][];
  };
}

/**
 * Style Change - Tracks modifications for code generation
 */
export interface StyleChange {
  elementId: string;
  property: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
}

/**
 * Code Change - Represents a modification to source code
 */
export interface CodeChange {
  filePath: string;
  type: 'css' | 'inline-style' | 'class' | 'html';
  selector?: string;
  changes: StyleChange[];
}

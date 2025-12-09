/**
 * DOM to Canvas Conversion Utilities
 * Bridges the gap between real DOM elements and canvas state
 */

import type { CanvasElement, DOMElementInfo, ElementType } from './types';
import { ElementType as ET } from './types';

/**
 * Message format from visual-editor-script.js
 */
interface ElementInfoMessage {
  id: string;
  tagName: string;
  className: string;
  textContent?: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    left: number;
  };
  computedStyles: Record<string, string>;
  sourceInfo: {
    selector: string;
    xpath: string;
    attributes: Record<string, string>;
    parentChain: string[];
  };
}

/**
 * Parse a DOM element (from iframe message) into a CanvasElement
 */
export function parseElementToCanvas(
  elementInfo: ElementInfoMessage,
  _iframeOffset: { x: number; y: number },
): CanvasElement {
  const { id, tagName, className, textContent, rect, computedStyles, sourceInfo } = elementInfo;

  // Determine element type based on tag and styles
  const type = determineElementType(tagName, computedStyles);

  // Use iframe-relative coordinates directly
  // The canvas overlay is positioned at the same origin as the iframe,
  // so we don't need to add the iframe offset
  const x = rect.x;
  const y = rect.y;

  // Extract visual properties from computed styles
  const canvasElement: CanvasElement = {
    id: sourceInfo.selector || id, // Use CSS selector as stable ID
    type,
    x,
    y,
    width: rect.width,
    height: rect.height,
    rotation: 0, // DOM elements don't have rotation initially
    opacity: parseFloat(computedStyles.opacity || '1'),

    // DOM Bridge
    domInfo: {
      selector: sourceInfo.selector,
      tagName,
      className,
      elementId: id,
      originalPosition: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      computedStyles,
    },
  };

  // Add type-specific properties
  if (type === ET.TEXT && textContent) {
    canvasElement.text = textContent;
    canvasElement.textColor = computedStyles.color;
    canvasElement.fontSize = parseInt(computedStyles.fontSize) || 16;
    canvasElement.fontFamily = computedStyles.fontFamily;
    canvasElement.fontWeight = parseInt(computedStyles.fontWeight) || 400;
  }

  // Visual properties (applicable to most elements)
  canvasElement.fillColor = computedStyles.backgroundColor;
  canvasElement.strokeColor = computedStyles.borderColor;
  canvasElement.strokeWidth = parseInt(computedStyles.borderWidth) || 0;
  canvasElement.borderRadius = parseInt(computedStyles.borderRadius) || 0;

  return canvasElement;
}

/**
 * Determine ElementType from tag name and computed styles
 */
function determineElementType(tagName: string, computedStyles: Record<string, string>): ElementType {
  const tag = tagName.toLowerCase();

  // Image elements
  if (tag === 'img') {
    return ET.IMAGE;
  }

  // SVG elements
  if (tag === 'svg') {
    return ET.SVG;
  }

  // Text-like elements
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'label', 'button'].includes(tag)) {
    return ET.TEXT;
  }

  // Check border-radius for circle detection
  const borderRadius = computedStyles.borderRadius || '0';

  if (borderRadius === '50%' || borderRadius === '9999px') {
    return ET.ELLIPSE;
  }

  // Default to rectangle for div, section, etc.
  return ET.RECTANGLE;
}

/**
 * Generate CSS string from CanvasElement changes
 */
export function generateCSSFromCanvas(original: CanvasElement, updated: CanvasElement): Record<string, string> {
  const styles: Record<string, string> = {};

  // Position changes
  if (updated.x !== original.x || updated.y !== original.y) {
    // Check if element had absolute/relative positioning
    const hasPositioning = original.domInfo?.computedStyles.position !== 'static';

    if (hasPositioning) {
      styles.left = `${updated.x - (original.domInfo?.originalPosition.x || 0)}px`;
      styles.top = `${updated.y - (original.domInfo?.originalPosition.y || 0)}px`;
    } else {
      // Convert to absolute positioning
      styles.position = 'absolute';
      styles.left = `${updated.x}px`;
      styles.top = `${updated.y}px`;
    }
  }

  // Size changes
  if (updated.width !== original.width) {
    styles.width = `${updated.width}px`;
  }

  if (updated.height !== original.height) {
    styles.height = `${updated.height}px`;
  }

  // Rotation
  if (updated.rotation !== original.rotation) {
    styles.transform = `rotate(${updated.rotation}deg)`;
  }

  // Opacity
  if (updated.opacity !== original.opacity) {
    styles.opacity = updated.opacity.toString();
  }

  // Visual properties
  if (updated.fillColor !== original.fillColor) {
    styles.backgroundColor = updated.fillColor || '';
  }

  if (updated.strokeColor !== original.strokeColor || updated.strokeWidth !== original.strokeWidth) {
    const width = updated.strokeWidth || 0;
    const color = updated.strokeColor || '#000';
    const borderStyle = updated.domInfo?.computedStyles.borderStyle || 'solid';

    styles.border = `${width}px ${borderStyle} ${color}`;
  }

  if (updated.borderRadius !== original.borderRadius) {
    styles.borderRadius = `${updated.borderRadius}px`;
  }

  // Text properties
  if (updated.textColor !== original.textColor) {
    styles.color = updated.textColor || '';
  }

  if (updated.fontSize !== original.fontSize) {
    styles.fontSize = `${updated.fontSize}px`;
  }

  if (updated.fontWeight !== original.fontWeight) {
    styles.fontWeight = updated.fontWeight?.toString() || '';
  }

  if (updated.fontFamily !== original.fontFamily) {
    styles.fontFamily = updated.fontFamily || '';
  }

  return styles;
}

/**
 * Apply canvas element changes to DOM element via postMessage
 */
export function syncCanvasToDOM(
  canvasElement: CanvasElement,
  iframeWindow: Window,
): void {
  if (!canvasElement.domInfo) {
    return;
  }

  const styles: Record<string, string> = {};

  // Position (convert from absolute canvas coords to element styles)
  if (canvasElement.domInfo.computedStyles.position === 'static') {
    // Need to set position for transforms to work
    styles.position = 'relative';
  }

  // Apply transform for position changes
  const deltaX = canvasElement.x - canvasElement.domInfo.originalPosition.x;
  const deltaY = canvasElement.y - canvasElement.domInfo.originalPosition.y;

  let transformParts: string[] = [];

  if (deltaX !== 0 || deltaY !== 0) {
    transformParts.push(`translate(${deltaX}px, ${deltaY}px)`);
  }

  if (canvasElement.rotation !== 0) {
    transformParts.push(`rotate(${canvasElement.rotation}deg)`);
  }

  if (transformParts.length > 0) {
    styles.transform = transformParts.join(' ');
  }

  // Size
  styles.width = `${canvasElement.width}px`;
  styles.height = `${canvasElement.height}px`;

  // Visual properties
  if (canvasElement.fillColor) {
    styles.backgroundColor = canvasElement.fillColor;
  }

  if (canvasElement.strokeColor && canvasElement.strokeWidth) {
    const borderStyle = canvasElement.domInfo.computedStyles.borderStyle || 'solid';
    styles.border = `${canvasElement.strokeWidth}px ${borderStyle} ${canvasElement.strokeColor}`;
  }

  if (canvasElement.borderRadius !== undefined) {
    styles.borderRadius = `${canvasElement.borderRadius}px`;
  }

  styles.opacity = canvasElement.opacity.toString();

  // Text properties
  if (canvasElement.textColor) {
    styles.color = canvasElement.textColor;
  }

  if (canvasElement.fontSize) {
    styles.fontSize = `${canvasElement.fontSize}px`;
  }

  if (canvasElement.fontWeight) {
    styles.fontWeight = canvasElement.fontWeight.toString();
  }

  if (canvasElement.fontFamily) {
    styles.fontFamily = canvasElement.fontFamily;
  }

  // Send update message to iframe
  iframeWindow.postMessage(
    {
      type: 'VISUAL_EDITOR_UPDATE_STYLE',
      elementId: canvasElement.domInfo.elementId,
      styles,
    },
    '*',
  );

  // Update text content if changed
  if (canvasElement.text !== undefined && canvasElement.type === ET.TEXT) {
    iframeWindow.postMessage(
      {
        type: 'VISUAL_EDITOR_UPDATE_TEXT',
        elementId: canvasElement.domInfo.elementId,
        text: canvasElement.text,
      },
      '*',
    );
  }
}

/**
 * Calculate iframe offset relative to viewport
 */
export function getIframeOffset(iframe: HTMLIFrameElement): { x: number; y: number } {
  const rect = iframe.getBoundingClientRect();

  return {
    x: rect.left,
    y: rect.top,
  };
}

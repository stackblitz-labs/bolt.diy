# Visual Editor Implementation Roadmap for Bolt.diy

## Current State (What We Have)

### Working Features
- ✅ **Message-passing architecture** between parent app and WebContainer preview iframe
- ✅ **Element selection** via click in preview
- ✅ **Style editing panel** with live updates:
  - Background color (color picker + text input)
  - Text color (color picker + text input)
  - Border (width, style, color)
  - Border radius (individual corners + all at once)
  - Padding
  - Font size
  - Font weight
  - Opacity slider
  - Text content editing
- ✅ **Live style updates** applied directly to DOM via `postMessage`
- ✅ **Injected script** (`/public/visual-editor-script.js`) handles element interaction

### Architecture
```
Bolt.diy App (localhost:5175)
    ↓
Preview.tsx (contains VisualEditorOverlay component)
    ↓
WebContainer iframe (*.webcontainer-api.io)
    ↓
visual-editor-script.js (injected via setPreviewScript)
    ↓
postMessage communication for:
    - VISUAL_EDITOR_ACTIVATE
    - VISUAL_EDITOR_SELECT
    - VISUAL_EDITOR_UPDATE_STYLE
    - VISUAL_EDITOR_UPDATE_TEXT
```

## What's Missing (Figma-Like Canvas Capabilities)

Based on analysis of the Figma clone reference in Downloads, we need:

### 1. **Drag & Resize System**

**Current Gap:** Elements can only be styled, not moved or resized.

**What Figma Clone Does:**
- Drag elements by clicking and dragging anywhere on the element
- 8 resize handles (corners + midpoints): `tl`, `t`, `tr`, `l`, `r`, `bl`, `b`, `br`
- Resize maintains aspect ratio when needed
- Real-time visual feedback during drag/resize

**Implementation Strategy:**
```typescript
// In visual-editor-script.js
class DragResizeHandler {
  private isDragging = false;
  private isResizing = false;
  private currentHandle: string | null = null;

  startDrag(element: HTMLElement, startX: number, startY: number) {
    // Track initial position
    // Add mousemove listener
    // Update element.style.left/top in real-time
  }

  startResize(element: HTMLElement, handle: string, startX: number, startY: number) {
    // Track initial size and position
    // Calculate new dimensions based on handle direction
    // Update element.style.width/height
  }
}
```

**Key Challenge:**
- Need to overlay resize handles on selected elements
- Handles must be positioned correctly relative to element bounds
- Must account for element rotation (advanced feature)

### 2. **Selection Box (Multi-Select)**

**Current Gap:** Can only select one element at a time by clicking.

**What Figma Clone Does:**
- Click-and-drag on canvas creates blue selection rectangle
- All elements intersecting the box get selected
- Multiple elements can be transformed together

**Implementation:**
```typescript
// Selection box state
interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// During mouse drag on canvas background:
// 1. Draw blue overlay rectangle
// 2. Check which elements intersect
// 3. Update selectedElementIds array
```

### 3. **Canvas Data Structure**

**Current Gap:** We're editing live DOM, not managing canvas state.

**What Figma Clone Uses:**
```typescript
interface CanvasElement {
  id: string;
  type: 'rectangle' | 'ellipse' | 'text' | 'image' | 'svg' | 'group';
  x: number;          // Canvas position
  y: number;
  width: number;
  height: number;
  rotation: number;   // Degrees
  opacity: number;    // 0-1

  // Shape properties
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  borderRadius?: number;

  // Text properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;

  // Group properties
  children?: CanvasElement[];
}
```

**Why This Matters:**
- Allows creating NEW elements (not just editing existing DOM)
- Enables save/export to JSON or code
- Supports undo/redo
- Proper z-index management

### 4. **Element Creation Tools**

**What Figma Clone Has:**
- Toolbar with element type buttons (Rectangle, Circle, Text, etc.)
- Click tool → click on canvas to create element at that position
- Elements start with default properties

**Implementation:**
```typescript
const addElement = (type: ElementType) => {
  const newElement: CanvasElement = {
    id: `element_${Date.now()}`,
    type,
    x: 150,
    y: 150,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    fillColor: '#3b82f6',
    // ... type-specific defaults
  };
  setElements([...elements, newElement]);
};
```

### 5. **Rotation Handle**

**What Figma Clone Does:**
- Small circle handle below element
- Drag to rotate element around center
- Visual feedback shows rotation angle

**Implementation:**
```typescript
// Calculate rotation angle from mouse position
const angle = Math.atan2(
  mouseY - centerY,
  mouseX - centerX
) * (180 / Math.PI);

element.style.transform = `rotate(${angle}deg)`;
```

### 6. **Grouping**

**What Figma Clone Does:**
- Select multiple elements → Cmd+G to group
- Group acts as single draggable/resizable unit
- Maintains relative positions of children
- Can ungroup back to individual elements

**Data Structure:**
```typescript
{
  id: 'group_123',
  type: ElementType.GROUP,
  x: 100,  // Group's top-left
  y: 100,
  width: 200,  // Bounding box
  height: 150,
  children: [
    { id: 'rect_1', x: 20, y: 20, ... },  // Relative to group
    { id: 'text_1', x: 50, y: 60, ... },
  ]
}
```

### 7. **Snap Guides & Grid**

**What Figma Clone Has:**
- Dot grid background for reference
- Pink guide lines appear when element aligns with others
- Snap to grid/guides on move

**Implementation:**
```css
/* Grid background */
background-image: radial-gradient(#d1d5db 1px, transparent 1px);
background-size: 20px 20px;
```

### 8. **Keyboard Shortcuts**

**What Figma Clone Supports:**
- `Delete` / `Backspace` - Delete selected
- `Cmd+C` - Copy
- `Cmd+D` - Duplicate
- `Cmd+G` - Group
- `Cmd+[` / `Cmd+]` - Send backward/forward
- Arrow keys - Nudge position

### 9. **Export Capabilities**

**What Figma Clone Has:**
- Export to PNG (canvas screenshot)
- Export to SVG
- Export to JSON (element data)
- Copy CSS styles

## Implementation Priority

### Phase 1: Core Canvas Functionality (HIGH PRIORITY)
1. **Add drag & resize to current setup**
   - Modify `visual-editor-script.js` to add drag handlers
   - Add resize handle overlays
   - Send position/size updates via `postMessage`

2. **Switch from DOM editing to Canvas state**
   - Create `CanvasElement` interface
   - Store elements in React state (VisualEditorOverlay)
   - Render elements as absolute-positioned divs
   - Sync changes back to WebContainer files via AI

### Phase 2: Advanced Interactions (MEDIUM PRIORITY)
3. **Multi-select & selection box**
4. **Rotation handle**
5. **Keyboard shortcuts**

### Phase 3: Professional Features (LOW PRIORITY)
6. **Grouping**
7. **Snap guides**
8. **Element creation tools**
9. **Export options**

## Technical Challenges

### Challenge 1: Cross-Origin Limitations
**Problem:** Cannot directly access WebContainer iframe DOM due to CORS.

**Solution:** Message-passing works, but we can't:
- Get real-time element bounds during drag (must send updates constantly)
- Overlay resize handles directly on elements (must approximate positions)

**Workaround:**
- Send frequent position updates during drag
- Use `getBoundingClientRect()` in iframe, send to parent via messages

### Challenge 2: Saving Changes to Code
**Problem:** Visual changes need to be written back to source files.

**Current Approach:**
- Track all changes in `codeSync` service
- Use AI to modify JSX/TSX source code
- Write back to WebContainer files

**Better Approach for Canvas:**
- Generate new component file from canvas state
- Use template-based code generation (no AI needed)
- Example:
```typescript
const generateReactCode = (elements: CanvasElement[]) => {
  return `
export default function CanvasDesign() {
  return (
    <div className="relative w-full h-screen">
      ${elements.map(el => `
      <div style={{
        position: 'absolute',
        left: '${el.x}px',
        top: '${el.y}px',
        width: '${el.width}px',
        height: '${el.height}px',
        backgroundColor: '${el.fillColor}',
        ...
      }}>
        ${el.text || ''}
      </div>
      `).join('\n')}
    </div>
  );
}`;
};
```

### Challenge 3: Performance
**Problem:** Sending `postMessage` on every mouse move can lag.

**Solutions:**
- Throttle updates to 60fps max (requestAnimationFrame)
- Only send deltas, not full element state
- Use local state during drag, sync on mouseup

## File Structure Recommendations

```
app/
├── components/
│   └── visual-editor/
│       ├── VisualEditorOverlay.tsx       # Main UI (move from Preview.tsx)
│       ├── Canvas.tsx                     # Canvas rendering area
│       ├── CanvasElement.tsx              # Individual draggable elements
│       ├── ResizeHandles.tsx              # 8-handle resize system
│       ├── SelectionBox.tsx               # Multi-select rectangle
│       ├── Toolbar.tsx                    # Element creation tools
│       ├── StylePanel.tsx                 # Properties panel (exists)
│       └── ExportModal.tsx                # Export UI
├── lib/
│   └── visual-editor/
│       ├── types.ts                       # CanvasElement interface
│       ├── canvas-state.ts                # State management
│       ├── drag-resize.ts                 # Drag/resize logic
│       ├── code-generator.ts              # Generate React from canvas
│       └── message-handler.ts             # iframe communication
└── public/
    └── visual-editor-script.js            # Iframe-side script (exists)
```

## Next Steps for Claude

When implementing canvas drag/resize:

1. **Read this file** to understand the architecture
2. **Check `/Users/isaaccohan/Downloads/figma-clone---canvas-editor (1)/`** for reference implementation
3. **Key files to study:**
   - `Canvas.tsx` - Selection box implementation
   - `CanvasElement.tsx` - Drag/resize logic with mouse events
   - `ResizeHandle.tsx` - Handle positioning
4. **Start with:** Adding drag functionality to current `visual-editor-script.js`
5. **Then:** Add resize handles overlay in `VisualEditorOverlay.tsx`

## Summary

**What works now:** Click element → edit styles → changes apply live
**What's needed:** Drag elements, resize with handles, multi-select, rotation
**How to do it:** Study the Figma clone reference, implement drag/resize in the iframe script, add handle overlays in the parent UI
**End goal:** Full Figma-like canvas editor for visually building Bolt.diy projects

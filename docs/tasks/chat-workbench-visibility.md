# Task: Always Show Chat Panel and Workbench in Chat Screen

## 1. Current Flow Analysis

### Current State Management

#### State Atoms
- **`chatStore.showChat`** (`app/lib/stores/chat.ts:8`)
  - Type: `boolean`
  - Default: `true`
  - Purpose: Controls chat panel visibility
  - Controlled by: Workbench sidebar toggle button

- **`workbenchStore.showWorkbench`** (`app/lib/stores/workbench.ts:51`)
  - Type: `Atom<boolean>`
  - Default: `false`
  - Purpose: Controls workbench visibility
  - Controlled by: Artifact header button, chat started state

#### Current Visibility Logic

**Chat Panel Visibility** (`app/components/chat/BaseChat.tsx:360`)
```typescript
<div
  className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
  data-chat-visible={showChat}
>
```

**CSS Animation** (`app/components/chat/BaseChat.module.scss:2-14`)
```scss
.BaseChat {
  &[data-chat-visible='false'] {
    --workbench-inner-width: 100%;
    --workbench-left: 0;

    .Chat {
      transition-property: transform, opacity;
      transition-duration: 0.3s;
      transform: translateX(-50%);  // Hides chat panel
      opacity: 0;
    }
  }
}
```

**Workbench Visibility** (`app/components/workbench/Workbench.client.tsx:283-406`)
```typescript
// Line 333: Conditional rendering
<motion.div
  initial={{ x: selectedView === 'code' ? 0 : '100%' }}
  animate={{
    x: showWorkbench ? (selectedView === 'code' ? 0 : '100%') : '100%'
  }}
>

// Line 334: Display condition
style={{
  display: chatStarted || showWorkbench ? 'flex' : 'none',
}}
```

**Toggle Button** (`app/components/workbench/Workbench.client.tsx:398-406`)
```typescript
<button
  className={`${showChat ? 'i-ph:sidebar-simple-fill' : 'i-ph:sidebar-simple'} text-lg`}
  disabled={!canHideChat || isSmallViewport}
  onClick={() => {
    if (canHideChat) {
      chatStore.setKey('showChat', !showChat);  // Toggle visibility
    }
  }}
/>
```

**Button Enablement Logic** (`app/components/workbench/Workbench.client.tsx:305`)
```typescript
const canHideChat = showWorkbench || !showChat;
```

### Current Flow Diagram

```
User enters chat screen
         ↓
chatStarted = false
showWorkbench = false
showChat = true
         ↓
Layout: [Chat Panel (Landing Page)] [Workbench (hidden off-screen)]
         ↓
User sends first message
         ↓
chatStarted = true
showWorkbench = false (still)
showChat = true
         ↓
Layout: [Chat Panel (Messages)] [Workbench (visible but can be toggled)]
         ↓
User clicks sidebar toggle in Workbench
         ↓
showChat = false
         ↓
Layout: [Chat Panel (hidden)] [Workbench (full width)]
```

### Current Behavior Summary

| State | `chatStarted` | `showWorkbench` | `showChat` | Chat Panel | Workbench | Layout |
|-------|---------------|-----------------|------------|------------|-----------|--------|
| Initial Landing | `false` | `false` | `true` | Visible (landing) | Hidden off-screen | Chat only |
| After First Message | `true` | `false` | `true` | Visible (messages) | Mounted but hidden | Chat only |
| Workbench Opened | `true` | `true` | `true` | Visible | Visible | Split view |
| Chat Hidden | `true` | `true` | `false` | Hidden (animated) | Visible (full width) | Workbench only |

### Files Involved in Current Implementation

1. **State Management**
   - `app/lib/stores/chat.ts` - chatStore with showChat atom
   - `app/lib/stores/workbench.ts` - workbenchStore with showWorkbench atom

2. **Components**
   - `app/components/chat/Chat.client.tsx` - Reads showChat from chatStore
   - `app/components/chat/BaseChat.tsx` - Receives showChat prop, sets data-chat-visible
   - `app/components/workbench/Workbench.client.tsx` - Toggle button and visibility logic

3. **Styles**
   - `app/components/chat/BaseChat.module.scss` - Chat panel hide/show animations

4. **Layout**
   - `app/components/chat/BaseChat.tsx:363` - Flex row layout with chat and workbench

### Issues with Current Flow

1. **Confusing UX**: Users can hide the chat panel, losing context of their conversation
2. **Inconsistent State**: Multiple boolean flags controlling visibility (showChat, showWorkbench, chatStarted)
3. **Hidden Content**: Chat history is hidden but still in DOM (wasteful if not needed)
4. **No Clear Affordance**: Toggle button doesn't clearly indicate it hides the entire chat panel
5. **Asymmetric Behavior**: Can hide chat but workbench always takes remaining space

---

## 2. Proposed Changes Plan

### Goal
Always show both chat panel and workbench side-by-side when in the chat screen, removing the ability to hide the chat panel.

### Design Decisions

#### Remove Chat Panel Toggle
- Remove the sidebar toggle button from workbench header
- Keep `chatStore.showChat` at default `true` always (or remove the state entirely)
- Simplify state management by removing unnecessary visibility control

#### Workbench Visibility
- Keep `workbenchStore.showWorkbench` for controlling when workbench appears
- Workbench should automatically show when `chatStarted = true`
- Remove manual toggle for workbench visibility (auto-show on first message)

#### Layout Strategy
- **Before Chat Starts**: Full-width chat panel with landing page
- **After Chat Starts**: Split view with fixed proportions (e.g., 40% chat, 60% workbench)
- **Responsive**: On small screens (mobile/tablet), stack vertically or use tabs

### Proposed Behavior

| State | `chatStarted` | Chat Panel | Workbench | Layout |
|-------|---------------|------------|-----------|--------|
| Initial Landing | `false` | Visible (landing) | Hidden | Chat only (full width) |
| After First Message | `true` | Visible (messages) | Visible (auto-shown) | Split view (40/60) |
| Subsequent Messages | `true` | Visible | Visible | Split view (40/60) |

### Updated Flow Diagram

```
User enters chat screen
         ↓
chatStarted = false
         ↓
Layout: [Chat Panel (Landing Page) - Full Width]
         ↓
User sends first message
         ↓
chatStarted = true
workbenchStore.showWorkbench.set(true)  // Auto-show
         ↓
Layout: [Chat Panel (40%)] [Workbench (60%)]
         ↓
User continues chatting
         ↓
Layout remains: [Chat Panel (40%)] [Workbench (60%)]
```

---

## 3. Implementation Plan

### Phase 1: Remove Chat Panel Toggle

#### Step 1.1: Remove Toggle Button UI
**File**: `app/components/workbench/Workbench.client.tsx`

**Changes**:
- Remove the sidebar toggle button (lines 398-406)
- Remove `canHideChat` logic (line 305)
- Remove `showChat` from useStore (line 304)

**Before**:
```typescript
const { showChat } = useStore(chatStore);
const canHideChat = showWorkbench || !showChat;

// ... later in JSX
<button
  className={`${showChat ? 'i-ph:sidebar-simple-fill' : 'i-ph:sidebar-simple'} text-lg`}
  disabled={!canHideChat || isSmallViewport}
  onClick={() => {
    if (canHideChat) {
      chatStore.setKey('showChat', !showChat);
    }
  }}
/>
```

**After**:
```typescript
// Remove showChat state reading
// Remove canHideChat logic
// Remove toggle button entirely
```

#### Step 1.2: Update BaseChat Component
**File**: `app/components/chat/BaseChat.tsx`

**Changes**:
- Remove `showChat` prop from BaseChatProps interface (line 46)
- Remove `data-chat-visible` attribute (line 360)
- Always render chat panel without conditional visibility

**Before**:
```typescript
interface BaseChatProps {
  showChat?: boolean;  // Remove this
  // ... other props
}

// ... later
<div
  className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
  data-chat-visible={showChat}  // Remove this
>
```

**After**:
```typescript
interface BaseChatProps {
  // showChat removed
  // ... other props
}

// ... later
<div
  className={classNames(styles.BaseChat, 'relative flex h-full w-full overflow-hidden')}
>
```

#### Step 1.3: Update Chat.client.tsx
**File**: `app/components/chat/Chat.client.tsx`

**Changes**:
- Remove `showChat` from chatStore reading (line 199)
- Remove `showChat` prop passed to BaseChat (line 962)

**Before**:
```typescript
const { showChat } = useStore(chatStore);

return (
  <BaseChat
    showChat={showChat}
    // ... other props
  />
);
```

**After**:
```typescript
// Remove showChat state reading

return (
  <BaseChat
    // showChat prop removed
    // ... other props
  />
);
```

#### Step 1.4: Remove CSS Animations
**File**: `app/components/chat/BaseChat.module.scss`

**Changes**:
- Remove the `data-chat-visible='false'` styles (lines 2-14)
- Keep base `.Chat` styles

**Before**:
```scss
.BaseChat {
  &[data-chat-visible='false'] {
    --workbench-inner-width: 100%;
    --workbench-left: 0;

    .Chat {
      transition-property: transform, opacity;
      transition-duration: 0.3s;
      transform: translateX(-50%);
      opacity: 0;
    }
  }
}

.Chat {
  opacity: 1;
}
```

**After**:
```scss
.BaseChat {
  // Remove conditional hiding styles
}

.Chat {
  opacity: 1;
}
```

#### Step 1.5: Clean Up chatStore (Optional)
**File**: `app/lib/stores/chat.ts`

**Decision**: Keep `showChat` in chatStore for backward compatibility, but don't use it.
Alternatively, remove it entirely if no other code depends on it.

**Option A - Keep (Safer)**:
```typescript
export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,  // Always true, kept for compatibility
  generationStatus: 'idle' as GenerationStatus,
  projectName: '' as string,
});
```

**Option B - Remove (Cleaner)**:
```typescript
export const chatStore = map({
  started: false,
  aborted: false,
  // showChat removed entirely
  generationStatus: 'idle' as GenerationStatus,
  projectName: '' as string,
});
```

**Recommendation**: Use Option A initially, then migrate to Option B after testing.

---

### Phase 2: Auto-Show Workbench on Chat Start

#### Step 2.1: Auto-Show Workbench When Chat Starts
**File**: `app/components/chat/Chat.client.tsx`

**Changes**:
- Add useEffect to automatically show workbench when chatStarted becomes true

**Location**: After line 393 (currently commented out code)

**Before**:
```typescript
/*
 * Always show workbench on mount so preview is visible immediately
 * workbenchStore.showWorkbench.set(true);
 */
```

**After**:
```typescript
// Auto-show workbench when chat starts
useEffect(() => {
  if (chatStarted) {
    workbenchStore.showWorkbench.set(true);
  }
}, [chatStarted]);
```

**Import Addition**:
```typescript
import { workbenchStore } from '~/lib/stores/workbench';
```

#### Step 2.2: Update Workbench Visibility Logic
**File**: `app/components/workbench/Workbench.client.tsx`

**Changes**:
- Simplify display condition to rely solely on `showWorkbench` atom
- Remove `chatStarted` from display logic (line 334)

**Before**:
```typescript
style={{
  display: chatStarted || showWorkbench ? 'flex' : 'none',
}}
```

**After**:
```typescript
style={{
  display: showWorkbench ? 'flex' : 'none',
}}
```

**Reasoning**: Since `showWorkbench` will be set to true when `chatStarted` becomes true (via useEffect), we don't need to check `chatStarted` anymore.

---

### Phase 3: Update Layout Proportions

#### Step 3.1: Define Fixed Chat/Workbench Proportions
**File**: `app/components/chat/BaseChat.tsx`

**Changes**:
- Update the flex-row layout to use fixed proportions
- Set chat panel to 40% width, workbench to 60% width
- Add CSS variables for easy customization

**Location**: Line 363 (flex-row container)

**Before**:
```typescript
<div className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
  <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:min-w-[var(--chat-min-width)] h-full')}>
```

**After**:
```typescript
<div className="flex flex-col lg:flex-row overflow-y-auto w-full h-full">
  <div
    className={classNames(
      styles.Chat,
      'flex flex-col h-full',
      chatStarted ? 'lg:w-[40%] lg:max-w-[600px]' : 'lg:w-full'
    )}
  >
```

**Add CSS Variables** (Optional - in `app/styles/variables.scss`):
```scss
:root {
  --chat-panel-width: 40%;
  --chat-panel-max-width: 600px;
  --workbench-width: 60%;
}
```

**Then use**:
```typescript
className={classNames(
  styles.Chat,
  'flex flex-col h-full',
  chatStarted ? 'lg:w-[var(--chat-panel-width)] lg:max-w-[var(--chat-panel-max-width)]' : 'lg:w-full'
)}
```

#### Step 3.2: Update Workbench Width
**File**: `app/components/workbench/Workbench.client.tsx`

**Changes**:
- Set workbench to take remaining width (60%)
- Remove CSS variable `--workbench-left` and `--workbench-inner-width` dependencies from BaseChat.module.scss

**Location**: Root motion.div container

**Before**:
```typescript
<motion.div
  className={classNames(
    // ... existing classes
  )}
  style={{
    // ... existing styles
  }}
>
```

**After**:
```typescript
<motion.div
  className={classNames(
    'workbench-container',
    'lg:w-[60%] w-full',
    // ... existing classes
  )}
  style={{
    // ... existing styles
  }}
>
```

---

### Phase 4: Responsive Behavior

#### Step 4.1: Mobile/Tablet Layout
**File**: `app/components/chat/BaseChat.tsx`

**Changes**:
- On small screens (< 1024px), stack chat and workbench vertically
- Chat panel takes full width, workbench below

**Implementation**:
Already handled by `flex flex-col lg:flex-row` in the container.

**Verify**:
- Mobile: Chat panel full width, workbench full width below
- Desktop (≥1024px): Chat 40%, Workbench 60% side-by-side

#### Step 4.2: Resizable Splitter (Future Enhancement)
**Optional**: Add a draggable splitter between chat and workbench for user-customizable widths.

**Libraries to Consider**:
- `react-split-pane`
- `react-resizable-panels`
- `allotment`

**Implementation Note**: This is a future enhancement and not part of the current task.

---

### Phase 5: Testing & Validation

#### Test Cases

1. **Initial Load**
   - [ ] Chat screen loads with landing page visible
   - [ ] Workbench is hidden off-screen
   - [ ] No toggle button visible in workbench header

2. **After First Message**
   - [ ] Chat panel shows messages on left (40% width on desktop)
   - [ ] Workbench automatically appears on right (60% width on desktop)
   - [ ] Both panels visible simultaneously
   - [ ] No way to hide chat panel

3. **Subsequent Messages**
   - [ ] Layout remains split view (40/60)
   - [ ] Both panels always visible
   - [ ] Messages scroll independently from workbench

4. **Responsive Behavior**
   - [ ] Mobile: Chat and workbench stack vertically
   - [ ] Tablet: Chat and workbench stack vertically
   - [ ] Desktop (≥1024px): Chat and workbench side-by-side

5. **Edge Cases**
   - [ ] Rapid message sending doesn't cause layout flicker
   - [ ] Browser resize maintains proportions
   - [ ] Full-screen mode works correctly

#### Manual Testing Steps

1. Open chat screen (`/`)
2. Verify landing page is full width
3. Send a message
4. Verify chat panel shrinks to 40% and workbench appears at 60%
5. Send more messages
6. Verify layout stays consistent
7. Resize browser window
8. Verify responsive breakpoints work
9. Check for any console errors or warnings
10. Test on Chrome, Firefox, Safari

#### Automated Tests to Add

**File**: `app/components/chat/__tests__/Chat.test.tsx` (create if doesn't exist)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { Chat } from '../Chat.client';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';

describe('Chat Panel Always Visible', () => {
  beforeEach(() => {
    chatStore.setKey('started', false);
    workbenchStore.showWorkbench.set(false);
  });

  test('shows chat panel on initial load', () => {
    render(<Chat />);
    expect(screen.getByText(/Where ideas begin/i)).toBeInTheDocument();
  });

  test('shows both chat and workbench after first message', async () => {
    render(<Chat />);

    // Simulate sending first message
    chatStore.setKey('started', true);

    await waitFor(() => {
      expect(workbenchStore.showWorkbench.get()).toBe(true);
    });
  });

  test('does not render chat toggle button', () => {
    render(<Chat />);
    const toggleButton = screen.queryByRole('button', { name: /sidebar/i });
    expect(toggleButton).not.toBeInTheDocument();
  });
});
```

---

## 4. Implementation Checklist

### Code Changes
- [ ] **Step 1.1**: Remove toggle button from Workbench.client.tsx
- [ ] **Step 1.2**: Remove showChat prop from BaseChat.tsx
- [ ] **Step 1.3**: Remove showChat usage from Chat.client.tsx
- [ ] **Step 1.4**: Remove conditional CSS from BaseChat.module.scss
- [ ] **Step 1.5**: Clean up chatStore (decide Option A or B)
- [ ] **Step 2.1**: Add auto-show workbench useEffect in Chat.client.tsx
- [ ] **Step 2.2**: Simplify workbench display condition
- [ ] **Step 3.1**: Update chat panel width proportions
- [ ] **Step 3.2**: Update workbench width proportions

### Testing
- [ ] Run `pnpm typecheck` - no TypeScript errors
- [ ] Run `pnpm lint` - no linting errors
- [ ] Run `pnpm test` - all tests pass
- [ ] Manual testing on Chrome
- [ ] Manual testing on Firefox
- [ ] Manual testing on Safari
- [ ] Mobile responsive testing (< 768px)
- [ ] Tablet responsive testing (768px - 1023px)
- [ ] Desktop testing (≥ 1024px)

### Documentation
- [ ] Update CLAUDE.md if architecture changes significantly
- [ ] Update any relevant comments in code
- [ ] Add JSDoc comments to modified functions
- [ ] Update this task.md with completion notes

### Code Review
- [ ] Self-review all changes
- [ ] Check for unused imports
- [ ] Check for unused CSS classes
- [ ] Verify no console warnings
- [ ] Verify accessibility (ARIA labels, keyboard navigation)

---

## 5. Rollback Plan

If issues arise, rollback steps:

1. **Revert Git Commits**
   ```bash
   git log --oneline  # Find commit hash before changes
   git revert <commit-hash>
   ```

2. **Restore Original Files**
   - Restore `chatStore.showChat` functionality
   - Restore toggle button in workbench header
   - Restore CSS animations for chat panel hiding

3. **Quick Fix**
   - Set `chatStore.showChat = true` by default
   - Disable toggle button: `disabled={true}`

---

## 6. Future Enhancements

### Resizable Panels
- Add draggable splitter between chat and workbench
- Save user's preferred split ratio in localStorage
- Respect user's layout preference across sessions

### Collapsible Panels
- Allow collapsing chat panel to a narrow sidebar (icon only)
- Quick access to recent messages via popover
- Keyboard shortcuts (e.g., Cmd+B to toggle chat width)

### Multi-Panel Layout
- Support 3-panel layout: Chat | Editor | Preview
- Allow users to customize panel arrangement
- Save layout preferences per project

---

## 7. Estimated Effort

| Phase | Estimated Time | Complexity |
|-------|----------------|------------|
| Phase 1: Remove Toggle | 1-2 hours | Low |
| Phase 2: Auto-Show Workbench | 30 minutes | Low |
| Phase 3: Update Layout | 1 hour | Medium |
| Phase 4: Responsive | 30 minutes | Low |
| Phase 5: Testing | 2-3 hours | Medium |
| **Total** | **5-7 hours** | **Low-Medium** |

---

## 8. Related Files Reference

### State Management
- `app/lib/stores/chat.ts` - Chat state store
- `app/lib/stores/workbench.ts` - Workbench state store

### Components
- `app/components/chat/Chat.client.tsx` - Main chat component
- `app/components/chat/BaseChat.tsx` - Base chat layout
- `app/components/workbench/Workbench.client.tsx` - Workbench container

### Styles
- `app/components/chat/BaseChat.module.scss` - Chat panel styles
- `app/styles/variables.scss` - Global CSS variables

### Types
- `app/components/chat/BaseChat.tsx:42-71` - BaseChatProps interface

---

## 9. Success Criteria

This task is complete when:

1. ✅ Chat panel is always visible in chat screen (no toggle to hide)
2. ✅ Workbench automatically shows when first message is sent
3. ✅ Both panels are visible side-by-side after chat starts
4. ✅ Layout is 40% chat, 60% workbench on desktop
5. ✅ Responsive layout works on mobile/tablet (stacked vertically)
6. ✅ No TypeScript errors
7. ✅ No linting errors
8. ✅ All existing tests pass
9. ✅ Manual testing confirms expected behavior
10. ✅ No console errors or warnings

---

## 10. Notes

- The current implementation allows hiding chat panel to maximize workbench space
- New behavior prioritizes always showing conversation context alongside code
- This aligns with HuskIT's goal of conversational website editing
- Future enhancement could add a resizable splitter for user control
- Mobile behavior unchanged (vertical stacking already exists)

---

**Created**: 2026-01-31
**Status**: Planning
**Assignee**: TBD
**Priority**: Medium
**Estimated Effort**: 5-7 hours

---
name: ui-shadcn-unocss-remix
description: Use when building or modifying UI components with shadcn/ui patterns, UnoCSS utilities, Radix primitives, and bolt design tokens. Covers component conventions, theming, accessibility, toast notifications, responsive design, and Remix integration. Triggers include "add component", "create UI", "shadcn", "Radix", "UnoCSS", "design tokens", "toast", "dialog", "button variant", "dark mode", "theme", "accessible", "ARIA".
---

# UI Components Skill (shadcn/ui + UnoCSS + Remix)

## Goal

Build consistent, accessible UI components following the established patterns with shadcn/ui, Radix primitives, UnoCSS utilities, and the bolt design token system.

## Directory Structure

```
app/
├── components/
│   ├── ui/                 # Reusable primitives (shadcn-style)
│   │   ├── Button.tsx
│   │   ├── Dialog.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── chat/               # Chat-specific components
│   ├── workbench/          # IDE workbench components
│   ├── editor/             # Code editor components
│   ├── @settings/          # Settings panel components
│   ├── sidebar/            # Sidebar navigation
│   ├── header/             # Header components
│   ├── deploy/             # Deployment UI
│   └── git/                # Git integration UI
├── styles/
│   ├── variables.scss      # CSS custom properties (design tokens)
│   ├── index.scss          # Global styles
│   ├── animations.scss     # Animation keyframes
│   └── z-index.scss        # Z-index scale
└── utils/
    └── classNames.ts       # Class merging utility
```

## Design Token System

### Token Hierarchy

```
CSS Variables (variables.scss)
        ↓
UnoCSS Theme (uno.config.ts)
        ↓
Component Classes (bolt-elements-*)
```

### Core Token Categories

| Category | Token Pattern | Example |
|----------|--------------|---------|
| Background | `bg-bolt-elements-background-depth-{1-4}` | `bg-bolt-elements-background-depth-1` |
| Text | `text-bolt-elements-text{Primary,Secondary,Tertiary}` | `text-bolt-elements-textPrimary` |
| Border | `border-bolt-elements-borderColor` | `border-bolt-elements-borderColorActive` |
| Button | `bg-bolt-elements-button-{type}-background` | `bg-bolt-elements-button-primary-background` |
| Item | `bg-bolt-elements-item-background{Active,Accent}` | `text-bolt-elements-item-contentAccent` |
| Icon | `text-bolt-elements-icon-{success,error,primary}` | `text-bolt-elements-icon-success` |

### Theme Support

Tokens automatically adapt to theme via `data-theme` attribute:

```scss
// variables.scss
:root[data-theme='light'] {
  --bolt-elements-textPrimary: theme('colors.gray.950');
}

:root[data-theme='dark'] {
  --bolt-elements-textPrimary: theme('colors.white');
}
```

## Component Patterns

### Basic Component Template

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

// Define variants with cva
const componentVariants = cva(
  // Base classes
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-bolt-elements-background text-bolt-elements-textPrimary',
        primary: 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
        secondary: 'bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text',
        danger: 'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text',
        ghost: 'hover:bg-bolt-elements-background-depth-1',
        outline: 'border border-bolt-elements-borderColor bg-transparent',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-10 px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {}

export const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        className={classNames(componentVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Component.displayName = 'Component';
```

### Button Component (Reference)

```tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { classNames } from '~/utils/classNames';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bolt-elements-borderColor disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-bolt-elements-background text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
        destructive: 'bg-red-500 text-white hover:bg-red-600',
        outline: 'border border-bolt-elements-borderColor bg-transparent hover:bg-bolt-elements-background-depth-2',
        secondary: 'bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
        ghost: 'hover:bg-bolt-elements-background-depth-1 hover:text-bolt-elements-textPrimary',
        link: 'text-bolt-elements-textPrimary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={classNames(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
```

### Dialog with Radix (Reference)

```tsx
import * as RadixDialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';

export const Dialog = ({ children, className, onClose }) => {
  return (
    <RadixDialog.Portal>
      {/* Backdrop */}
      <RadixDialog.Overlay asChild>
        <motion.div
          className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      </RadixDialog.Overlay>
      
      {/* Content */}
      <RadixDialog.Content asChild>
        <motion.div
          className={classNames(
            'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'bg-white dark:bg-gray-950 rounded-lg shadow-xl',
            'border border-bolt-elements-borderColor z-[9999]',
            'w-[520px] focus:outline-none',
            className
          )}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
        >
          {children}
        </motion.div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
};
```

## Toast Notifications

### Using react-toastify

```tsx
import { useToast } from '~/components/ui/use-toast';

function MyComponent() {
  const { success, error, info, warning } = useToast();
  
  const handleAction = async () => {
    try {
      await doSomething();
      success('Action completed successfully');
    } catch (err) {
      error('Something went wrong');
    }
  };
  
  return <button onClick={handleAction}>Do Action</button>;
}
```

### Direct toast usage

```tsx
import { toast } from '~/components/ui/use-toast';

// Simple notifications
toast.success('Saved!');
toast.error('Failed to save');
toast.info('Processing...');
toast.warning('Check your input');

// With options
toast.success('Saved!', { autoClose: 5000 });
```

### Toast Guidelines

- ✅ Use for user feedback on actions
- ✅ Use for async operation results
- ✅ Keep messages concise
- ❌ Don't use for validation errors (show inline)
- ❌ Don't suppress errors silently

## UnoCSS Utilities

### Custom Shortcuts (uno.config.ts)

```typescript
shortcuts: {
  'bolt-ease-cubic-bezier': 'ease-[cubic-bezier(0.4,0,0.2,1)]',
  'transition-theme': 'transition-[background-color,border-color,color] duration-150 bolt-ease-cubic-bezier',
  'kdb': 'bg-bolt-elements-code-background text-bolt-elements-code-text py-1 px-1.5 rounded-md',
  'max-w-chat': 'max-w-[var(--chat-max-width)]',
}
```

### Icon Usage

Icons use UnoCSS icon preset with custom bolt collection:

```tsx
// Phosphor icons (most common)
<div className="i-ph:house" />
<div className="i-ph:gear" />
<div className="i-ph:x" />
<div className="i-ph:check" />

// Custom bolt icons
<div className="i-bolt:logo" />
<div className="i-bolt:custom-icon" />

// With sizing
<div className="i-ph:house text-xl" />
<div className="i-ph:gear w-6 h-6" />
```

### Common Utility Patterns

```tsx
// Background depth levels
<div className="bg-bolt-elements-background-depth-1" />  // Main background
<div className="bg-bolt-elements-background-depth-2" />  // Elevated surface
<div className="bg-bolt-elements-background-depth-3" />  // Higher elevation

// Text hierarchy
<span className="text-bolt-elements-textPrimary" />      // Main text
<span className="text-bolt-elements-textSecondary" />    // Supporting text
<span className="text-bolt-elements-textTertiary" />     // Muted text

// Borders
<div className="border border-bolt-elements-borderColor" />
<div className="border border-bolt-elements-borderColorActive" />

// Hover states
<button className="hover:bg-bolt-elements-background-depth-2" />
<button className="hover:bg-bolt-elements-item-backgroundActive" />
```

## Accessibility Guidelines

### Focus Management

```tsx
// Always include focus styles
<button className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bolt-elements-borderColorActive">
  Click me
</button>

// For dialogs, trap focus
<RadixDialog.Content>
  {/* Focus automatically trapped */}
</RadixDialog.Content>
```

### ARIA Live Regions

For streaming/dynamic content:

```tsx
<div aria-live="polite" aria-atomic="true">
  {streamingContent}
</div>
```

### Keyboard Navigation

```tsx
// Use Radix primitives for complex interactions
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';

// They handle:
// - Arrow key navigation
// - Escape to close
// - Tab trapping in modals
// - Screen reader announcements
```

## Responsive Design

### Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Mobile | 320px | Minimum supported |
| Tablet | 768px | `md:` prefix |
| Desktop | 1280px | `lg:` prefix |

### Responsive Patterns

```tsx
// Stack on mobile, row on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Hide on mobile
<div className="hidden md:block">Desktop only</div>

// Different sizes
<button className="h-8 md:h-10 px-3 md:px-4">
  Responsive Button
</button>
```

## Animation Patterns

### With Framer Motion

```tsx
import { motion, type Variants } from 'framer-motion';
import { cubicEasingFn } from '~/utils/easings';

const variants: Variants = {
  closed: { opacity: 0, scale: 0.96 },
  open: { opacity: 1, scale: 1 },
};

<motion.div
  initial="closed"
  animate="open"
  exit="closed"
  variants={variants}
  transition={{ duration: 0.15, ease: cubicEasingFn }}
>
  Content
</motion.div>
```

### CSS Animations

```tsx
// Spinner
<div className="i-ph:spinner-gap animate-spin" />

// Pulse
<div className="animate-pulse" />

// Custom (from animations.scss)
<div className="animate-fade-in" />
```

## Component Checklist

- [ ] Uses design tokens (bolt-elements-*) for colors
- [ ] Uses `classNames()` utility for class merging
- [ ] Uses `cva` for variant management
- [ ] Includes focus-visible styles
- [ ] Supports dark/light themes automatically
- [ ] Uses Radix primitives for complex interactions
- [ ] Has proper TypeScript types
- [ ] Exports from component index if reusable
- [ ] Responsive at 320/768/1280px breakpoints
- [ ] Uses toast for user feedback (not console.log)
- [ ] Includes ARIA attributes where needed

## Available UI Components

| Component | Path | Description |
|-----------|------|-------------|
| `Button` | `ui/Button.tsx` | Primary button with variants |
| `Dialog` | `ui/Dialog.tsx` | Modal dialog with Radix |
| `Input` | `ui/Input.tsx` | Text input field |
| `Checkbox` | `ui/Checkbox.tsx` | Checkbox with label |
| `Switch` | `ui/Switch.tsx` | Toggle switch |
| `Tabs` | `ui/Tabs.tsx` | Tab navigation |
| `Dropdown` | `ui/Dropdown.tsx` | Dropdown menu |
| `Tooltip` | `ui/Tooltip.tsx` | Hover tooltip |
| `Popover` | `ui/Popover.tsx` | Click popover |
| `Badge` | `ui/Badge.tsx` | Status badge |
| `Card` | `ui/Card.tsx` | Content card |
| `Progress` | `ui/Progress.tsx` | Progress bar |
| `ScrollArea` | `ui/ScrollArea.tsx` | Custom scrollbar |
| `Slider` | `ui/Slider.tsx` | Range slider |
| `IconButton` | `ui/IconButton.tsx` | Icon-only button |

## References

- `app/components/ui/Button.tsx` - Button with cva variants
- `app/components/ui/Dialog.tsx` - Radix dialog patterns
- `app/components/ui/use-toast.ts` - Toast hook
- `app/styles/variables.scss` - Design tokens
- `uno.config.ts` - UnoCSS configuration
- `app/utils/classNames.ts` - Class merging utility
- `references/design-tokens.md` - Token reference

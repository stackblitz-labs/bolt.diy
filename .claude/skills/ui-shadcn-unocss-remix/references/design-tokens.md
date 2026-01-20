# Design Tokens Reference

## Token Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CSS Custom Properties                         │
│                   (app/styles/variables.scss)                    │
│                                                                  │
│  --bolt-elements-textPrimary: theme('colors.gray.950');         │
│  --bolt-elements-background-depth-1: theme('colors.white');     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      UnoCSS Theme                                │
│                     (uno.config.ts)                              │
│                                                                  │
│  bolt: {                                                        │
│    elements: {                                                  │
│      textPrimary: 'var(--bolt-elements-textPrimary)',          │
│      background: { depth: { 1: 'var(--bolt-elements-bg-...)' }}│
│    }                                                            │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Component Classes                            │
│                                                                  │
│  <div className="text-bolt-elements-textPrimary">               │
│  <div className="bg-bolt-elements-background-depth-1">          │
└─────────────────────────────────────────────────────────────────┘
```

## Color Primitives

### Base Colors (uno.config.ts)

```typescript
const BASE_COLORS = {
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',   100: '#F5F5F5',  200: '#E5E5E5',
    300: '#D4D4D4',  400: '#A3A3A3',  500: '#737373',
    600: '#525252',  700: '#404040',  800: '#262626',
    900: '#171717',  950: '#0A0A0A',
  },
  accent: {
    50: '#F8F5FF',   100: '#F0EBFF',  200: '#E1D6FF',
    300: '#CEBEFF',  400: '#B69EFF',  500: '#9C7DFF',
    600: '#8A5FFF',  700: '#7645E8',  800: '#6234BB',
    900: '#502D93',  950: '#2D1959',
  },
  green: {
    50: '#F0FDF4',   100: '#DCFCE7',  200: '#BBF7D0',
    300: '#86EFAC',  400: '#4ADE80',  500: '#22C55E',
    600: '#16A34A',  700: '#15803D',  800: '#166534',
    900: '#14532D',  950: '#052E16',
  },
  red: {
    50: '#FEF2F2',   100: '#FEE2E2',  200: '#FECACA',
    300: '#FCA5A5',  400: '#F87171',  500: '#EF4444',
    600: '#DC2626',  700: '#B91C1C',  800: '#991B1B',
    900: '#7F1D1D',  950: '#450A0A',
  },
  orange: {
    50: '#FFFAEB',   100: '#FEEFC7',  200: '#FEDF89',
    300: '#FEC84B',  400: '#FDB022',  500: '#F79009',
    600: '#DC6803',  700: '#B54708',  800: '#93370D',
    900: '#792E0D',
  },
};
```

## Semantic Tokens by Category

### Background Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `bg-bolt-elements-background-depth-1` | white | gray.950 | Main background |
| `bg-bolt-elements-background-depth-2` | gray.50 | gray.900 | Elevated surface |
| `bg-bolt-elements-background-depth-3` | gray.200 | gray.800 | Higher elevation |
| `bg-bolt-elements-background-depth-4` | alpha.gray.5 | alpha.white.5 | Subtle surface |

### Text Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `text-bolt-elements-textPrimary` | gray.950 | white | Main text |
| `text-bolt-elements-textSecondary` | gray.600 | gray.400 | Supporting text |
| `text-bolt-elements-textTertiary` | gray.500 | gray.500 | Muted text |

### Border Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `border-bolt-elements-borderColor` | alpha.gray.10 | alpha.white.10 | Default border |
| `border-bolt-elements-borderColorActive` | accent.600 | accent.500 | Active/focus border |

### Button Tokens

| Variant | Background | Hover | Text |
|---------|------------|-------|------|
| Primary | `alpha.accent.10` | `alpha.accent.20` | `accent.500` |
| Secondary | `alpha.gray.5` / `alpha.white.5` | `alpha.gray.10` / `alpha.white.10` | `gray.950` / `white` |
| Danger | `alpha.red.10` | `alpha.red.20` | `red.500` |

```tsx
// Usage
<button className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text">
  Primary
</button>
```

### Item Tokens (Lists, Cards)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `bg-bolt-elements-item-backgroundDefault` | transparent | transparent | Default |
| `bg-bolt-elements-item-backgroundActive` | alpha.gray.5 | alpha.white.10 | Hover/selected |
| `bg-bolt-elements-item-backgroundAccent` | alpha.accent.10 | alpha.accent.10 | Accent highlight |
| `bg-bolt-elements-item-backgroundDanger` | alpha.red.10 | alpha.red.10 | Danger state |
| `text-bolt-elements-item-contentDefault` | alpha.gray.50 | alpha.white.50 | Default content |
| `text-bolt-elements-item-contentActive` | gray.950 | white | Active content |
| `text-bolt-elements-item-contentAccent` | accent.700 | accent.500 | Accent content |
| `text-bolt-elements-item-contentDanger` | red.500 | red.500 | Danger content |

### Icon Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `text-bolt-elements-icon-success` | green.500 | green.400 | Success state |
| `text-bolt-elements-icon-error` | red.500 | red.400 | Error state |
| `text-bolt-elements-icon-primary` | gray.950 | gray.950 | Primary icon |
| `text-bolt-elements-icon-secondary` | gray.600 | gray.600 | Secondary icon |
| `text-bolt-elements-icon-tertiary` | gray.500 | gray.500 | Tertiary icon |

### Code Tokens

| Token | Light | Dark |
|-------|-------|------|
| `bg-bolt-elements-code-background` | gray.100 | gray.800 |
| `text-bolt-elements-code-text` | gray.950 | white |

### Message Tokens

| Token | Light | Dark |
|-------|-------|------|
| `bg-bolt-elements-messages-background` | gray.100 | gray.800 |
| `text-bolt-elements-messages-linkColor` | accent.500 | accent.500 |
| `bg-bolt-elements-messages-inlineCode-background` | gray.200 | gray.700 |

## Layout Variables

```scss
:root {
  --header-height: 54px;
  --chat-max-width: 33rem;
  --chat-min-width: 533px;
  --workbench-width: min(calc(100% - var(--chat-min-width)), 2536px);
}
```

## Z-Index Scale

```scss
// From z-index.scss
$z-sidebar: 40;
$z-header: 50;
$z-dropdown: 100;
$z-modal-backdrop: 9998;
$z-modal: 9999;
$z-toast: 10000;
```

## Terminal Colors

```scss
// Light theme
--bolt-terminal-foreground: #333333;
--bolt-terminal-red: #cd3131;
--bolt-terminal-green: #00bc00;
--bolt-terminal-yellow: #949800;
--bolt-terminal-blue: #0451a5;

// Dark theme
--bolt-terminal-foreground: #eff0eb;
--bolt-terminal-red: #ff5c57;
--bolt-terminal-green: #5af78e;
--bolt-terminal-yellow: #f3f99d;
--bolt-terminal-blue: #57c7ff;
```

## Quick Reference

### Most Used Tokens

```tsx
// Backgrounds
className="bg-bolt-elements-background-depth-1"  // Main bg
className="bg-bolt-elements-background-depth-2"  // Card bg

// Text
className="text-bolt-elements-textPrimary"       // Main text
className="text-bolt-elements-textSecondary"     // Muted text

// Borders
className="border border-bolt-elements-borderColor"

// Interactive states
className="hover:bg-bolt-elements-background-depth-2"
className="hover:bg-bolt-elements-item-backgroundActive"

// Accent colors
className="text-bolt-elements-item-contentAccent"
className="bg-bolt-elements-item-backgroundAccent"

// Status
className="text-bolt-elements-icon-success"
className="text-bolt-elements-icon-error"
```

### Complete Button Example

```tsx
<button
  className={classNames(
    // Base
    'inline-flex items-center justify-center rounded-md',
    'text-sm font-medium transition-colors',
    // Focus
    'focus-visible:outline-none focus-visible:ring-1',
    'focus-visible:ring-bolt-elements-borderColorActive',
    // Disabled
    'disabled:pointer-events-none disabled:opacity-50',
    // Variant: primary
    'bg-bolt-elements-button-primary-background',
    'text-bolt-elements-button-primary-text',
    'hover:bg-bolt-elements-button-primary-backgroundHover',
    // Size
    'h-9 px-4 py-2'
  )}
>
  Button
</button>
```

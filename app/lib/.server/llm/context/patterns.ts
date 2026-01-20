/**
 * Pattern Matching Configuration
 *
 * Defines core bundle patterns and keyword-to-file mappings for the hybrid
 * context selection system. These patterns are optimized for restaurant
 * website templates with predictable file structures.
 *
 * @module context/patterns
 */

/**
 * Core bundle patterns that should always be included in context selection.
 *
 * Files matching these patterns receive a +10 boost score because they
 * represent the foundational structure of restaurant websites:
 * - Page components (pages/, App.tsx, main.tsx)
 * - Layout structure (Layout, Footer)
 * - Styling (index.css, styles/)
 * - Data files (data/)
 *
 * **Pattern Matching Behavior**:
 * - Uses substring matching via `String.includes()`
 * - Case-sensitive matching
 * - Order does not affect scoring (each pattern checked independently)
 *
 * @example
 * ```typescript
 * // These files would match:
 * '/home/project/src/pages/Home.tsx'    // matches 'pages/'
 * '/home/project/src/App.tsx'           // matches 'App.tsx'
 * '/home/project/src/index.css'         // matches 'index.css'
 * '/home/project/src/components/Layout.tsx' // matches 'Layout'
 * ```
 */
export const CORE_PATTERNS: readonly string[] = [
  'pages/',
  'App.tsx',
  'main.tsx',
  'index.css',
  'styles/',
  'data/',
  'Layout',
  'Footer',
] as const;

/**
 * Keyword-to-file pattern mapping for intelligent file selection.
 *
 * Maps common user query keywords to relevant file patterns. When a keyword
 * is found in the user's message (case-insensitive), all files matching the
 * associated patterns receive a +5 boost score.
 *
 * **Pattern Matching Behavior**:
 * - Keywords are extracted from lowercased user message
 * - Pattern matching uses substring matching via `String.includes()`
 * - Multiple patterns per keyword allow broad coverage
 * - Patterns are case-sensitive for file matching
 *
 * **Extensibility**:
 * This map can be extended with template-specific keywords. For example,
 * a bakery template might add mappings like 'pastry' → ['Menu', 'Bakery'].
 *
 * @example
 * ```typescript
 * // User query: "change the header color"
 * // Extracted keywords: ['header', 'color']
 * // Matched patterns: ['Hero', 'Layout', 'Navbar', 'index.css', 'styles/', ...]
 * // Files receiving +5 boost: Hero.tsx, Layout.tsx, Navbar.tsx, index.css, etc.
 * ```
 */
export const KEYWORD_MAP: Readonly<Record<string, readonly string[]>> = {
  // Navigation and Header
  header: ['Hero', 'Layout', 'Navbar', 'Header'],
  hero: ['Hero', 'Home'],
  menu: ['Menu', 'MenuPreview', 'data/'],
  navigation: ['Layout', 'Navbar', 'Nav', 'Header'],
  nav: ['Layout', 'Navbar', 'Nav', 'Header'],
  navbar: ['Layout', 'Navbar', 'Header'],
  logo: ['Layout', 'Hero', 'Header', 'Navbar'],

  // Footer
  footer: ['Footer'],

  // About Section
  about: ['About', 'Story'],
  story: ['Story', 'About'],

  // Styling
  color: ['index.css', 'styles/', 'tailwind.config', 'guidelines/', 'theme'],
  colour: ['index.css', 'styles/', 'tailwind.config', 'guidelines/', 'theme'],
  font: ['index.css', 'styles/', 'tailwind.config', 'typography'],
  style: ['index.css', 'styles/', 'tailwind.config'],
  theme: ['styles/', 'guidelines/', 'tailwind.config', 'theme'],
  background: ['index.css', 'styles/', 'Hero', 'Layout'],
  css: ['index.css', 'styles/', 'tailwind.config'],

  // UI Elements
  button: ['Hero', 'ui/Button', 'Button', 'CTA'],
  headline: ['Hero', 'Home'],
  title: ['Hero', 'Home', 'Layout'],
  banner: ['Hero', 'Banner'],
  image: ['Hero', 'Gallery', 'About', 'Menu'],
  photo: ['Hero', 'Gallery', 'About'],
  picture: ['Hero', 'Gallery', 'About'],

  // Menu and Food
  dish: ['Menu', 'MenuPreview', 'data/'],
  dishes: ['Menu', 'MenuPreview', 'data/'],
  food: ['Menu', 'MenuPreview', 'data/'],
  price: ['Menu', 'MenuPreview', 'data/'],
  prices: ['Menu', 'MenuPreview', 'data/'],
  item: ['Menu', 'MenuPreview', 'data/'],
  items: ['Menu', 'MenuPreview', 'data/'],
  category: ['Menu', 'MenuPreview', 'data/'],
  categories: ['Menu', 'MenuPreview', 'data/'],

  // Contact and Info
  contact: ['Footer', 'Contact', 'data/'],
  hours: ['Footer', 'Hours', 'data/'],
  address: ['Footer', 'Contact', 'data/'],
  phone: ['Footer', 'Contact', 'data/'],
  email: ['Footer', 'Contact', 'data/'],
  location: ['Footer', 'Contact', 'Map', 'data/'],
  map: ['Map', 'Contact', 'Footer'],

  // Features and Services
  feature: ['Feature', 'Features'],
  features: ['Feature', 'Features'],
  service: ['Feature', 'Service', 'Services'],
  services: ['Feature', 'Service', 'Services'],

  // Gallery
  gallery: ['Gallery', 'Photos'],
  photos: ['Gallery', 'Photos'],

  // Reservations
  reservation: ['Reservation', 'Book', 'CTA'],
  reservations: ['Reservation', 'Book', 'CTA'],
  book: ['Reservation', 'Book', 'CTA'],
  booking: ['Reservation', 'Book', 'CTA'],

  // Social
  social: ['Footer', 'Social'],
  instagram: ['Footer', 'Social'],
  facebook: ['Footer', 'Social'],
  twitter: ['Footer', 'Social'],

  // Layout
  layout: ['Layout', 'App'],
  page: ['pages/', 'Home', 'App'],
  section: ['Hero', 'About', 'Menu', 'Feature', 'Footer'],

  // Text Content
  text: ['Hero', 'About', 'data/'],
  content: ['Hero', 'About', 'data/'],
  copy: ['Hero', 'About', 'data/'],
  description: ['Hero', 'About', 'Menu', 'data/'],
  tagline: ['Hero', 'Home'],
  slogan: ['Hero', 'Home'],

  // Home
  home: ['Home', 'pages/', 'index'],
  landing: ['Home', 'pages/', 'Hero'],
  main: ['Home', 'main.tsx', 'App'],
} as const;

/**
 * Type for keyword keys to enable type-safe lookups.
 */
export type KeywordKey = keyof typeof KEYWORD_MAP;

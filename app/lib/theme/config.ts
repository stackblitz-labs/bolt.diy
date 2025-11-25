import type { MultiSelectOption } from '~/components/ui/multiselect';

// Sans-serif font options
export const sansSerifFonts: MultiSelectOption[] = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Source Sans Pro',
  'Raleway',
  'PT Sans',
  'Nunito',
  'Poppins',
  'Ubuntu',
  'Oswald',
  'Mulish',
  'Work Sans',
  'Rubik',
  'Manrope',
  'DM Sans',
  'Outfit',
  'Plus Jakarta Sans',
  'Space Grotesk',
  'Archivo',
  'Barlow',
  'Karla',
  'Public Sans',
  'Red Hat Display',
  'Quicksand',
  'Josefin Sans',
  'Varela Round',
  'Nunito Sans',
  'Assistant',
  'Heebo',
  'Maven Pro',
  'IBM Plex Sans',
  'Cabin',
  'Lexend',
  'Mukta',
  'Titillium Web',
  'Exo 2',
  'Hind',
  'Oxygen',
  'ABeeZee',
  'Advent Pro',
  'Alata',
  'Almarai',
  'Antic',
  'Architects Daughter',
  'Asap',
  'Bebas Neue',
  'Cairo',
  'Comfortaa',
  'Dosis',
  'Figtree',
  'Hind Siliguri',
  'Jost',
  'Kanit',
  'M PLUS Rounded 1c',
  'Noto Sans',
  'Overpass',
  'Play',
  'Prompt',
  'Questrial',
  'Rajdhani',
  'Saira',
  'Signika',
  'Tajawal',
  'Urbanist',
  'Yantramanav',
].map((font) => ({ label: font, value: font }));

// Serif font options
export const serifFonts: MultiSelectOption[] = [
  'Merriweather',
  'PT Serif',
  'Playfair Display',
  'Lora',
  'Source Serif 4',
  'Noto Serif',
  'Crimson Text',
  'Libre Baskerville',
  'EB Garamond',
  'Bitter',
  'Arvo',
  'Vollkorn',
  'Cardo',
  'Old Standard TT',
  'Cormorant Garamond',
  'Neuton',
  'Spectral',
  'Alegreya',
  'PT Serif Caption',
  'Frank Ruhl Libre',
  'IBM Plex Serif',
  'Crimson Pro',
  'Literata',
  'Brygada 1918',
  'Georgia',
  'Times New Roman',
  'Garamond',
  'Baskerville',
  'Palatino',
  'Cambria',
  'Alice',
  'Arapey',
  'BioRhyme',
  'Bree Serif',
  'Caudex',
  'Cinzel',
  'Copse',
  'Domine',
  'Gelasio',
  'Glegoo',
  'Judson',
  'Kameron',
  'Ledger',
  'Lusitana',
  'Noticia Text',
  'Poly',
  'Podkova',
  'Prociono',
  'Quattrocento',
  'Rokkitt',
  'Rufina',
  'Sanchez',
  'Tinos',
  'Ultra',
  'Vidaloka',
  'Yeseva One',
].map((font) => ({ label: font, value: font }));

// Monospace font options
export const monoFonts: MultiSelectOption[] = [
  'Roboto Mono',
  'JetBrains Mono',
  'Source Code Pro',
  'Fira Code',
  'Ubuntu Mono',
  'Inconsolata',
  'Space Mono',
  'IBM Plex Mono',
  'Courier Prime',
  'PT Mono',
  'Anonymous Pro',
  'Overpass Mono',
  'Cousine',
  'Share Tech Mono',
  'DM Mono',
  'Red Hat Mono',
  'Azeret Mono',
  'B612 Mono',
  'Courier New',
  'Monaco',
  'Consolas',
  'Menlo',
  'Cascadia Code',
  'Noto Sans Mono',
  'Oxygen Mono',
  'VT323',
  'Major Mono Display',
  'Cutive Mono',
  'Nova Mono',
  'Syne Mono',
  'Xanh Mono',
].map((font) => ({ label: font, value: font }));

// Border radius presets
export const radiusPresets = [
  { value: 0, label: 'None', previewRadius: '0' },
  { value: 0.375, label: 'SM', previewRadius: '4px' },
  { value: 0.5, label: 'MD', previewRadius: '8px' },
  { value: 0.75, label: 'LG', previewRadius: '10px' },
  { value: 1, label: 'XL', previewRadius: '12px' },
  { value: 9999, label: 'Full', previewRadius: '100%' },
];

// Spacing unit presets
export const spacingPresets = [
  { value: 4, label: 'Small' },
  { value: 5, label: 'Medium' },
  { value: 6, label: 'Large' },
];

// Border width presets
export const borderWidthPresets = [
  { value: 0.5, label: 'Thin' },
  { value: 1, label: 'Medium' },
  { value: 2, label: 'Thick' },
  { value: 4, label: 'Extra' },
];

// Default color values
export const defaultColors = {
  primary: { light: '38 92% 50%' },
  primaryForeground: { light: '0 0% 0%' },
  secondary: { light: '220 14% 96%' },
  secondaryForeground: { light: '215 14% 34%' },
  accent: { light: '48 100% 96%' },
  accentForeground: { light: '23 83% 31%' },
  background: { light: '0 0% 100%' },
  foreground: { light: '0 0% 15%' },
  card: { light: '0 0% 100%' },
  cardForeground: { light: '0 0% 15%' },
  muted: { light: '210 20% 98%' },
  mutedForeground: { light: '220 9% 46%' },
  border: { light: '220 13% 91%' },
  destructive: { light: '0 84% 60%' },
  destructiveForeground: { light: '0 0% 100%' },
};

// Default additional colors
export const defaultAdditionalColors = {
  success: { light: '142 71% 45%' },
  successForeground: { light: '0 0% 100%' },
  warning: { light: '38 92% 50%' },
  warningForeground: { light: '0 0% 0%' },
  danger: { light: '0 84% 60%' },
  dangerForeground: { light: '0 0% 100%' },
  sidebar: { light: '240 5% 6%' },
  sidebarForeground: { light: '240 5% 90%' },
  sidebarPrimary: { light: '240 6% 10%' },
  sidebarPrimaryForeground: { light: '0 0% 98%' },
  sidebarAccent: { light: '240 4% 16%' },
  sidebarAccentForeground: { light: '240 6% 90%' },
  sidebarBorder: { light: '240 4% 16%' },
  sidebarRing: { light: '217 91% 60%' },
};

// Color categories for the color picker sections
export const colorCategories = {
  primary: ['primary', 'primaryForeground'],
  secondary: ['secondary', 'secondaryForeground'],
  accent: ['accent', 'accentForeground'],
  base: ['background', 'foreground', 'muted', 'mutedForeground', 'border'],
  card: ['card', 'cardForeground'],
  destructive: ['destructive', 'destructiveForeground'],
  status: ['success', 'successForeground', 'warning', 'warningForeground', 'danger', 'dangerForeground'],
  sidebar: [
    'sidebar',
    'sidebarForeground',
    'sidebarPrimary',
    'sidebarPrimaryForeground',
    'sidebarAccent',
    'sidebarAccentForeground',
    'sidebarBorder',
    'sidebarRing',
  ],
};

// Helper to format color key to label
export const formatColorLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

// Helper to convert color key to CSS variable name
export const colorKeyToCssVar = (key: string): string => {
  return `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
};

export const CUSTOM_THEME_NAME = 'custom';

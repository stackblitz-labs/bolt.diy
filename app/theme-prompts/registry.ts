/**
 * Restaurant Theme Registry
 *
 * Registry for all restaurant themes with metadata and utility functions.
 * Theme prompts are imported using Vite's ?raw suffix to load them as strings.
 */

import type { RestaurantTheme, RestaurantThemeId } from '~/types/restaurant-theme';

/*
 * Import all 12 theme prompt files as raw strings
 * NOTE: Only IndochineluxePrompt is active - others commented out until zip files are added
 * import Artisanhearthv3Prompt from './Artisanhearthv3.md?raw';
 * import BamboobistroPrompt from './Bamboobistro.md?raw';
 * import Boldfeastv2Prompt from './Boldfeastv2.md?raw';
 * import ChromaticstreetPrompt from './Chromaticstreet.md?raw';
 * import Classicminimalistv2Prompt from './Classicminimalistv2.md?raw';
 * import DynamicfusionPrompt from './Dynamicfusion.md?raw';
 * import FreshmarketPrompt from './Freshmarket.md?raw';
 * import GastrobotanicalPrompt from './Gastrobotanical.md?raw';
 */
import IndochineluxePrompt from './Indochineluxe.md?raw';

/*
 * import Noirluxev3Prompt from './Noirluxev3.md?raw';
 * import SaiGonverandaPrompt from './SaiGonveranda.md?raw';
 * import TherednoodlePrompt from './Therednoodle.md?raw';
 */

/**
 * Array containing all 12 restaurant themes with their metadata.
 * Each theme includes cuisine types, style tags, and associated template name.
 */
export const RESTAURANT_THEMES: RestaurantTheme[] = [
  /*
   * NOTE: Only indochineluxe is enabled - other themes commented out until zip files are added
   * {
   *   id: 'artisanhearthv3',
   *   label: 'The Artisan Hearth v3',
   *   description: 'Rustic farm-to-table with handcrafted aesthetics and warm, organic textures',
   *   cuisines: ['farm-to-table', 'american', 'new-american', 'organic', 'sustainable'],
   *   styleTags: ['rustic', 'warm', 'handcrafted', 'organic', 'farmhouse'],
   *   templateName: 'Artisan Hearth v3',
   *   prompt: Artisanhearthv3Prompt,
   * },
   * {
   *   id: 'bamboobistro',
   *   label: 'The Bamboo Bistro',
   *   description: 'Modern Asian casual dining with night market vibes and zen aesthetics',
   *   cuisines: ['asian', 'chinese', 'ramen', 'thai', 'japanese', 'izakaya', 'dim-sum'],
   *   styleTags: ['casual', 'energetic', 'night-market', 'modern', 'zen'],
   *   templateName: 'Bamboo Bistro',
   *   prompt: BamboobistroPrompt,
   * },
   * {
   *   id: 'boldfeastv2',
   *   label: 'Bold Feast v2',
   *   description: 'Contemporary American bistro with bold flavors and industrial-chic design',
   *   cuisines: ['american', 'contemporary', 'bistro', 'gastropub', 'craft-cocktails'],
   *   styleTags: ['bold', 'industrial', 'contemporary', 'urban', 'gastropub'],
   *   templateName: 'Bold Feast v2',
   *   prompt: Boldfeastv2Prompt,
   * },
   * {
   *   id: 'chromaticstreet',
   *   label: 'Chromatic Street',
   *   description: 'Vibrant street food culture with neon accents and urban photography',
   *   cuisines: ['street-food', 'fusion', 'food-truck', 'international', 'casual'],
   *   styleTags: ['vibrant', 'neon', 'urban', 'street-art', 'photography-focused'],
   *   templateName: 'Chromatic Street',
   *   prompt: ChromaticstreetPrompt,
   * },
   * {
   *   id: 'classicminimalistv2',
   *   label: 'Classic Minimalist v2',
   *   description: 'Elegant fine dining with minimalist design and refined Scandinavian aesthetics',
   *   cuisines: ['fine-dining', 'european', 'scandinavian', 'contemporary', 'tasting-menu'],
   *   styleTags: ['minimalist', 'elegant', 'scandinavian', 'refined', 'clean'],
   *   templateName: 'Classic Minimalist v2',
   *   prompt: Classicminimalistv2Prompt,
   * },
   * {
   *   id: 'dynamicfusion',
   *   label: 'Dynamic Fusion',
   *   description: 'High-energy fusion cuisine with dramatic plating and modern molecular techniques',
   *   cuisines: ['fusion', 'molecular-gastronomy', 'contemporary', 'asian-fusion', 'latin-fusion'],
   *   styleTags: ['dynamic', 'dramatic', 'modern', 'molecular', 'experimental'],
   *   templateName: 'Dynamic Fusion',
   *   prompt: DynamicfusionPrompt,
   * },
   * {
   *   id: 'freshmarket',
   *   label: 'Fresh Market',
   *   description: 'Bright and airy farmers market concept with fresh produce photography',
   *   cuisines: ['mediterranean', 'healthy', 'vegetarian', 'farmers-market', 'light'],
   *   styleTags: ['bright', 'airy', 'fresh', 'natural-lighting', 'produce-focused'],
   *   templateName: 'Fresh Market',
   *   prompt: FreshmarketPrompt,
   * },
   * {
   *   id: 'gastrobotanical',
   *   label: 'Gastrobotanical',
   *   description: 'Botanical garden restaurant with herb gardens and scientific illustration style',
   *   cuisines: ['botanical', 'herbal', 'garden-to-table', 'seasonal', 'foraged'],
   *   styleTags: ['botanical', 'scientific', 'garden', 'herbal', 'illustrated'],
   *   templateName: 'Gastrobotanical',
   *   prompt: GastrobotanicalPrompt,
   * },
   */
  {
    id: 'indochineluxe',
    label: 'Indochine Luxe',
    description: 'Luxurious Southeast Asian dining with colonial architecture and silk textiles',
    cuisines: ['vietnamese', 'french-indochine', 'luxury', 'fine-dining', 'colonial'],
    styleTags: ['luxurious', 'colonial', 'silk', 'architectural', 'elegant'],
    templateName: 'Indochine Luxe',
    prompt: IndochineluxePrompt,
  },

  /*
   * {
   *   id: 'noirluxev3',
   *   label: 'Noir Luxe v3',
   *   description: 'Sophisticated dark-themed fine dining with gold accents and dramatic lighting',
   *   cuisines: ['fine-dining', 'contemporary', 'french', 'luxury', 'wine-focused'],
   *   styleTags: ['dark', 'luxurious', 'gold-accents', 'dramatic', 'sophisticated'],
   *   templateName: 'Noir Luxe v3',
   *   prompt: Noirluxev3Prompt,
   * },
   * {
   *   id: 'saigonveranda',
   *   label: 'Saigon Veranda',
   *   description: 'Vietnamese street food meets French café culture with veranda seating',
   *   cuisines: ['vietnamese', 'french-cafe', 'street-food', 'pho', 'banh-mi'],
   *   styleTags: ['veranda', 'french-colonial', 'casual', 'outdoor-seating', 'vintage'],
   *   templateName: 'Saigon Veranda',
   *   prompt: SaiGonverandaPrompt,
   * },
   * {
   *   id: 'therednoodle',
   *   label: 'The Red Noodle',
   *   description: 'Traditional Asian noodle house with red lanterns and communal dining',
   *   cuisines: ['noodles', 'ramen', 'asian', 'communal', 'comfort-food'],
   *   styleTags: ['red-lanterns', 'communal', 'traditional', 'warm', 'nostalgic'],
   *   templateName: 'The Red Noodle',
   *   prompt: TherednoodlePrompt,
   * },
   */
];

/**
 * Get a restaurant theme by its ID
 */
export function getThemeById(id: RestaurantThemeId): RestaurantTheme | undefined {
  return RESTAURANT_THEMES.find((theme) => theme.id === id);
}

/**
 * Get a restaurant theme by its template name
 */
export function getThemeByTemplateName(templateName: string): RestaurantTheme | undefined {
  return RESTAURANT_THEMES.find((theme) => theme.templateName === templateName);
}

/**
 * Get the prompt content for a specific theme ID
 */
export function getThemePrompt(id: RestaurantThemeId): string | null {
  const theme = getThemeById(id);
  return theme ? theme.prompt : null;
}

/**
 * Get a simplified list of all available themes
 */
export function getThemeList(): Array<{ id: RestaurantThemeId; label: string; cuisines: string[] }> {
  return RESTAURANT_THEMES.map(({ id, label, cuisines }) => ({
    id,
    label,
    cuisines,
  }));
}

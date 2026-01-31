import { LLMManager } from '~/lib/modules/llm/manager';
import type { Template } from '~/types/template';

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;
export const MODIFICATIONS_TAG_NAME = 'bolt_file_modifications';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const PROVIDER_REGEX = /\[Provider: (.*?)\]\n\n/;
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
export const PROMPT_COOKIE_KEY = 'cachedPrompt';
export const TOOL_EXECUTION_APPROVAL = {
  APPROVE: 'Yes, approved.',
  REJECT: 'No, rejected.',
} as const;
export const TOOL_NO_EXECUTE_FUNCTION = 'Error: No execute function found on tool';
export const TOOL_EXECUTION_DENIED = 'Error: User denied access to tool execution';
export const TOOL_EXECUTION_ERROR = 'Error: An error occured while calling tool';

const isTest = typeof process !== 'undefined' && !!process.env?.VITEST;
const llmManager = isTest ? null : LLMManager.getInstance(import.meta.env);

export const PROVIDER_LIST = llmManager ? llmManager.getAllProviders() : [];
export const DEFAULT_PROVIDER = llmManager ? llmManager.getDefaultProvider() : undefined;

export const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {};

if (PROVIDER_LIST.length > 0) {
  PROVIDER_LIST.forEach((provider) => {
    providerBaseUrlEnvKeys[provider.name] = {
      baseUrlKey: provider.config.baseUrlKey,
      apiTokenKey: provider.config.apiTokenKey,
    };
  });
}

// starter Templates

export const STARTER_TEMPLATES: Template[] = [
  // Restaurant Templates
  // NOTE: Only Indochine Luxe is enabled - other themes commented out until zip files are added
  // {
  //   name: 'Artisan Hearth v3',
  //   label: 'Artisan Hearth v3',
  //   description: 'Rustic farm-to-table restaurant website with warm, organic textures and handcrafted aesthetics',
  //   githubRepo: 'neweb-learn/Artisanhearthv3',
  //   tags: ['restaurant', 'farm-to-table', 'american', 'organic', 'rustic'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'artisanhearthv3',
  // },
  // {
  //   name: 'Bamboo Bistro',
  //   label: 'Bamboo Bistro',
  //   description: 'Modern Asian casual dining restaurant with night market vibes and zen aesthetics',
  //   githubRepo: 'neweb-learn/Bamboobistro',
  //   tags: ['restaurant', 'asian', 'chinese', 'japanese', 'casual'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'bamboobistro',
  // },
  // {
  //   name: 'Bold Feast v2',
  //   label: 'Bold Feast v2',
  //   description: 'Contemporary American bistro restaurant with bold flavors and industrial-chic design',
  //   githubRepo: 'neweb-learn/Boldfeastv2',
  //   tags: ['restaurant', 'american', 'bistro', 'contemporary', 'gastropub'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'boldfeastv2',
  // },
  // {
  //   name: 'Chromatic Street',
  //   label: 'Chromatic Street',
  //   description: 'Vibrant street food restaurant concept with neon accents and urban photography',
  //   githubRepo: 'neweb-learn/Chromaticstreet',
  //   tags: ['restaurant', 'street-food', 'fusion', 'urban', 'vibrant'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'chromaticstreet',
  // },
  // {
  //   name: 'Classic Minimalist v2',
  //   label: 'Classic Minimalist v2',
  //   description: 'Elegant fine dining restaurant with minimalist design and refined Scandinavian aesthetics',
  //   githubRepo: 'neweb-learn/Classicminimalistv2',
  //   tags: ['restaurant', 'fine-dining', 'scandinavian', 'minimalist', 'elegant'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'classicminimalistv2',
  // },
  // {
  //   name: 'Dynamic Fusion',
  //   label: 'Dynamic Fusion',
  //   description: 'High-energy fusion cuisine restaurant with dramatic plating and modern molecular techniques',
  //   githubRepo: 'neweb-learn/Dynamicfusion',
  //   tags: ['restaurant', 'fusion', 'molecular-gastronomy', 'contemporary', 'experimental'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'dynamicfusion',
  // },
  // {
  //   name: 'Fresh Market',
  //   label: 'Fresh Market',
  //   description: 'Bright and airy farmers market restaurant concept with fresh produce photography',
  //   githubRepo: 'neweb-learn/Freshmarket',
  //   tags: ['restaurant', 'mediterranean', 'healthy', 'farmers-market', 'bright'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'freshmarket',
  // },
  // {
  //   name: 'Gastrobotanical',
  //   label: 'Gastrobotanical',
  //   description: 'Botanical garden restaurant with herb gardens and scientific illustration style',
  //   githubRepo: 'neweb-learn/Gastrobotanical',
  //   tags: ['restaurant', 'botanical', 'herbal', 'garden-to-table', 'seasonal'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'gastrobotanical',
  // },
  {
    name: 'Indochine Luxe',
    label: 'Indochine Luxe',
    description: 'Luxurious Southeast Asian dining restaurant with colonial architecture and silk textiles',
    githubRepo: 'neweb-learn/Indochineluxe',
    tags: ['restaurant', 'vietnamese', 'french-indochine', 'luxury', 'fine-dining'],
    icon: 'i-bolt:restaurant',
    category: 'restaurant',
    restaurantThemeId: 'indochineluxe',
  },
  // {
  //   name: 'Noir Luxe v3',
  //   label: 'Noir Luxe v3',
  //   description: 'Sophisticated dark-themed fine dining restaurant with gold accents and dramatic lighting',
  //   githubRepo: 'neweb-learn/Noirluxev3',
  //   tags: ['restaurant', 'fine-dining', 'contemporary', 'french', 'luxury'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'noirluxev3',
  // },
  // {
  //   name: 'Saigon Veranda',
  //   label: 'Saigon Veranda',
  //   description: 'Vietnamese street food restaurant meets French café culture with veranda seating',
  //   githubRepo: 'neweb-learn/Saigonveranda',
  //   tags: ['restaurant', 'vietnamese', 'french-cafe', 'street-food', 'pho'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'saigonveranda',
  // },
  // {
  //   name: 'The Red Noodle',
  //   label: 'The Red Noodle',
  //   description: 'Traditional Asian noodle house restaurant with red lanterns and communal dining',
  //   githubRepo: 'neweb-learn/Therednoodle',
  //   tags: ['restaurant', 'noodles', 'ramen', 'asian', 'communal'],
  //   icon: 'i-bolt:restaurant',
  //   category: 'restaurant',
  //   restaurantThemeId: 'therednoodle',
  // },

  // Generic Templates (existing)
  // {
  //   name: 'Expo App',
  //   label: 'Expo App',
  //   description: 'Expo starter template for building cross-platform mobile apps',
  //   githubRepo: 'xKevIsDev/bolt-expo-template',
  //   tags: ['mobile', 'expo', 'mobile-app', 'android', 'iphone'],
  //   icon: 'i-bolt:expo',
  // },
  // {
  //   name: 'Basic Astro',
  //   label: 'Astro Basic',
  //   description: 'Lightweight Astro starter template for building fast static websites',
  //   githubRepo: 'xKevIsDev/bolt-astro-basic-template',
  //   tags: ['astro', 'blog', 'performance'],
  //   icon: 'i-bolt:astro',
  // },
  // {
  //   name: 'NextJS Shadcn',
  //   label: 'Next.js with shadcn/ui',
  //   description: 'Next.js starter fullstack template integrated with shadcn/ui components and styling system',
  //   githubRepo: 'xKevIsDev/bolt-nextjs-shadcn-template',
  //   tags: ['nextjs', 'react', 'typescript', 'shadcn', 'tailwind'],
  //   icon: 'i-bolt:nextjs',
  // },
  // {
  //   name: 'Vite Shadcn',
  //   label: 'Vite with shadcn/ui',
  //   description: 'Vite starter fullstack template integrated with shadcn/ui components and styling system',
  //   githubRepo: 'xKevIsDev/vite-shadcn',
  //   tags: ['vite', 'react', 'typescript', 'shadcn', 'tailwind'],
  //   icon: 'i-bolt:shadcn',
  // },
  // {
  //   name: 'Qwik Typescript',
  //   label: 'Qwik TypeScript',
  //   description: 'Qwik framework starter with TypeScript for building resumable applications',
  //   githubRepo: 'xKevIsDev/bolt-qwik-ts-template',
  //   tags: ['qwik', 'typescript', 'performance', 'resumable'],
  //   icon: 'i-bolt:qwik',
  // },
  // {
  //   name: 'Remix Typescript',
  //   label: 'Remix TypeScript',
  //   description: 'Remix framework starter with TypeScript for full-stack web applications',
  //   githubRepo: 'xKevIsDev/bolt-remix-ts-template',
  //   tags: ['remix', 'typescript', 'fullstack', 'react'],
  //   icon: 'i-bolt:remix',
  // },
  // {
  //   name: 'Slidev',
  //   label: 'Slidev Presentation',
  //   description: 'Slidev starter template for creating developer-friendly presentations using Markdown',
  //   githubRepo: 'xKevIsDev/bolt-slidev-template',
  //   tags: ['slidev', 'presentation', 'markdown'],
  //   icon: 'i-bolt:slidev',
  // },
  // {
  //   name: 'Sveltekit',
  //   label: 'SvelteKit',
  //   description: 'SvelteKit starter template for building fast, efficient web applications',
  //   githubRepo: 'bolt-sveltekit-template',
  //   tags: ['svelte', 'sveltekit', 'typescript'],
  //   icon: 'i-bolt:svelte',
  // },
  // {
  //   name: 'Vanilla Vite',
  //   label: 'Vanilla + Vite',
  //   description: 'Minimal Vite starter template for vanilla JavaScript projects',
  //   githubRepo: 'xKevIsDev/vanilla-vite-template',
  //   tags: ['vite', 'vanilla-js', 'minimal'],
  //   icon: 'i-bolt:vite',
  // },
  // {
  //   name: 'Vite React',
  //   label: 'React + Vite + typescript',
  //   description: 'React starter template powered by Vite for fast development experience',
  //   githubRepo: 'xKevIsDev/bolt-vite-react-ts-template',
  //   tags: ['react', 'vite', 'frontend', 'website', 'app'],
  //   icon: 'i-bolt:react',
  // },
  {
    name: 'Vite Typescript',
    label: 'Vite + TypeScript',
    description: 'Vite starter template with TypeScript configuration for type-safe development',
    githubRepo: 'xKevIsDev/bolt-vite-ts-template',
    tags: ['vite', 'typescript', 'minimal'],
    icon: 'i-bolt:typescript',
  },
  // {
  //   name: 'Vue',
  //   label: 'Vue.js',
  //   description: 'Vue.js starter template with modern tooling and best practices',
  //   githubRepo: 'xKevIsDev/bolt-vue-template',
  //   tags: ['vue', 'typescript', 'frontend'],
  //   icon: 'i-bolt:vue',
  // },
  // {
  //   name: 'Angular',
  //   label: 'Angular Starter',
  //   description: 'A modern Angular starter template with TypeScript support and best practices configuration',
  //   githubRepo: 'xKevIsDev/bolt-angular-template',
  //   tags: ['angular', 'typescript', 'frontend', 'spa'],
  //   icon: 'i-bolt:angular',
  // },
  // {
  //   name: 'SolidJS',
  //   label: 'SolidJS Tailwind',
  //   description: 'Lightweight SolidJS starter template for building fast static websites',
  //   githubRepo: 'xKevIsDev/solidjs-ts-tw',
  //   tags: ['solidjs'],
  //   icon: 'i-bolt:solidjs',
  // },
];

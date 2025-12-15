/**
 * Content Transformer Service
 * Maps crawler output data to template-specific content format
 *
 * This service transforms the structured CrawlerOutput into a format
 * that can be directly injected into restaurant template content files.
 */

import type { CrawlerOutput } from '~/types/info-collection';
import type { RestaurantThemeId } from '~/types/restaurant-theme';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ContentTransformer');

/*
 * ============================================================================
 * Template Content Types
 * ============================================================================
 */

export interface TemplateContent {
  seo: {
    title: string;
    description: string;
  };
  navigation: Array<{ label: string; path: string }>;
  hero: {
    eyebrow?: string;
    headline: string;
    subheadline: string;
    cta: { label: string; link: string };
    image?: { src: string; alt: string };
  };
  about: {
    heading: string;
    body: string;
    cta?: { label: string; link: string };
  };
  menuHighlights: {
    heading: string;
    items: Array<{
      name: string;
      price: string;
      description: string;
    }>;
    cta: { label: string; link: string };
  };
  testimonials?: {
    heading: string;
    subheading: string;
    badge?: string;
    items: Array<{
      author: string;
      text: string;
      rating: number;
    }>;
  };
  contact: {
    address: string;
    phone: string;
    email?: string;
    bookingUrl?: string;
    serviceArea?: string;
  };
  social: {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
    tiktok?: string;
  };
  footer: {
    copyright: string;
    tagline?: string;
  };
  brand: {
    name: string;
    tagline: string;
    colors: {
      primary: string;
      accent: string;
    };
    isDarkMode: boolean;
  };
}

/*
 * ============================================================================
 * Theme-specific Configuration
 * ============================================================================
 */

interface ThemeConfig {
  heroCtaLabel: string;
  menuHeading: string;
  aboutHeading: string;
  testimonialHeading: string;
  eyebrowStyle: 'date' | 'location' | 'greeting' | 'none';
}

const THEME_CONFIGS: Record<RestaurantThemeId, ThemeConfig> = {
  artisanhearthv3: {
    heroCtaLabel: 'View Our Menu',
    menuHeading: 'From the Hearth',
    aboutHeading: 'Our Story',
    testimonialHeading: 'What Our Guests Say',
    eyebrowStyle: 'date',
  },
  bamboobistro: {
    heroCtaLabel: 'Explore Menu',
    menuHeading: "Chef's Signatures",
    aboutHeading: 'Tradition Meets Today',
    testimonialHeading: 'Local Legends',
    eyebrowStyle: 'location',
  },
  boldfeastv2: {
    heroCtaLabel: 'See the Menu',
    menuHeading: 'Bold Flavors',
    aboutHeading: 'Our Craft',
    testimonialHeading: 'Rave Reviews',
    eyebrowStyle: 'none',
  },
  chromaticstreet: {
    heroCtaLabel: 'Check Menu',
    menuHeading: 'Street Favorites',
    aboutHeading: 'The Vibe',
    testimonialHeading: 'Street Cred',
    eyebrowStyle: 'none',
  },
  classicminimalistv2: {
    heroCtaLabel: 'View Menu',
    menuHeading: 'Seasonal Selection',
    aboutHeading: 'Philosophy',
    testimonialHeading: 'Guest Experiences',
    eyebrowStyle: 'none',
  },
  dynamicfusion: {
    heroCtaLabel: 'Discover Menu',
    menuHeading: 'Fusion Creations',
    aboutHeading: 'The Journey',
    testimonialHeading: "Critics' Choice",
    eyebrowStyle: 'none',
  },
  freshmarket: {
    heroCtaLabel: "Today's Menu",
    menuHeading: 'Fresh Picks',
    aboutHeading: 'Farm to Table',
    testimonialHeading: 'Happy Guests',
    eyebrowStyle: 'greeting',
  },
  gastrobotanical: {
    heroCtaLabel: 'Explore Menu',
    menuHeading: 'Garden Selections',
    aboutHeading: 'Our Garden',
    testimonialHeading: 'Botanical Reviews',
    eyebrowStyle: 'none',
  },
  indochineluxe: {
    heroCtaLabel: 'View Menu',
    menuHeading: 'Signature Dishes',
    aboutHeading: 'Heritage',
    testimonialHeading: 'Distinguished Guests',
    eyebrowStyle: 'location',
  },
  noirluxev3: {
    heroCtaLabel: 'Experience Menu',
    menuHeading: 'Tasting Menu',
    aboutHeading: 'The Vision',
    testimonialHeading: 'Acclaimed Reviews',
    eyebrowStyle: 'none',
  },
  saigonveranda: {
    heroCtaLabel: 'See Menu',
    menuHeading: 'House Specialties',
    aboutHeading: 'Our Roots',
    testimonialHeading: 'Guest Stories',
    eyebrowStyle: 'greeting',
  },
  therednoodle: {
    heroCtaLabel: 'View Menu',
    menuHeading: 'Noodle House Favorites',
    aboutHeading: 'Our Tradition',
    testimonialHeading: 'Noodle Lovers Say',
    eyebrowStyle: 'location',
  },
};

/*
 * ============================================================================
 * Content Generation Helpers
 * ============================================================================
 */

/**
 * Generate eyebrow text based on theme style
 */
function generateEyebrow(style: ThemeConfig['eyebrowStyle'], _brandName: string): string | undefined {
  switch (style) {
    case 'date':
      return 'Est. 2024';
    case 'location':
      return 'Welcome to';
    case 'greeting':
      return 'Hello & Welcome';
    case 'none':
    default:
      return undefined;
  }
}

/**
 * Generate hero headline from brand strategy
 */
function generateHeadline(crawlerOutput: CrawlerOutput): string {
  const coreIdentity = crawlerOutput.business_intelligence.core_identity;
  const industryContext = crawlerOutput.business_intelligence.industry_context;

  // Use tagline if available, otherwise generate based on category
  if (coreIdentity.tagline_inferred) {
    return coreIdentity.tagline_inferred;
  }

  // Generate based on category
  const category = industryContext.primary_category.toLowerCase();

  if (category.includes('italian')) {
    return 'Authentic Taste of Italy';
  }

  if (category.includes('vietnamese')) {
    return 'Fresh Flavors of Vietnam';
  }

  if (category.includes('chinese') || category.includes('asian')) {
    return 'A Journey Through Flavor';
  }

  if (category.includes('fine dining')) {
    return 'An Unforgettable Culinary Experience';
  }

  return `Welcome to ${coreIdentity.brand_display_name}`;
}

/**
 * Generate subheadline from USP and target audience
 */
function generateSubheadline(crawlerOutput: CrawlerOutput): string {
  const inferredUsp = crawlerOutput.brand_strategy.inferred_usp;
  const targetAudience = crawlerOutput.brand_strategy.target_audience_persona;

  if (inferredUsp) {
    return inferredUsp;
  }

  return `Crafted for ${targetAudience.toLowerCase()}`;
}

/**
 * Generate about section body text
 */
function generateAboutBody(crawlerOutput: CrawlerOutput): string {
  const coreIdentity = crawlerOutput.business_intelligence.core_identity;
  const industryContext = crawlerOutput.business_intelligence.industry_context;
  const brandStrategy = crawlerOutput.brand_strategy;

  const highlights = industryContext.operational_highlights.join(', ');

  return (
    `At ${coreIdentity.brand_display_name}, we believe in ${brandStrategy.inferred_usp.toLowerCase()}. ` +
    `Our ${industryContext.primary_category.toLowerCase()} offers ${highlights.toLowerCase()}, ` +
    `creating the perfect atmosphere for ${brandStrategy.target_audience_persona.toLowerCase()}. ` +
    `Every dish tells a story of passion, quality, and dedication to our craft.`
  );
}

/**
 * Generate placeholder menu items based on category
 */
function generateMenuItems(crawlerOutput: CrawlerOutput): TemplateContent['menuHighlights']['items'] {
  const category = crawlerOutput.business_intelligence.industry_context.primary_category.toLowerCase();
  const priceTier = crawlerOutput.business_intelligence.industry_context.price_tier;

  // Price ranges by tier
  const priceRange = {
    Budget: { min: 8, max: 15 },
    Standard: { min: 14, max: 28 },
    Premium: { min: 25, max: 45 },
    Luxury: { min: 40, max: 85 },
  }[priceTier];

  const getPrice = (base: number) => `$${Math.round(base + Math.random() * (priceRange.max - priceRange.min))}`;

  // Category-specific menu items
  const menusByCategory: Record<string, Array<{ name: string; description: string }>> = {
    italian: [
      { name: 'Margherita Pizza', description: 'San Marzano tomatoes, fresh mozzarella, basil' },
      { name: 'Pappardelle Bolognese', description: 'House-made pasta, slow-cooked meat ragù' },
      { name: 'Osso Buco', description: 'Braised veal shank, gremolata, risotto Milanese' },
    ],
    vietnamese: [
      { name: 'Phở Bò Đặc Biệt', description: '12-hour beef broth, rare beef, brisket, tendon' },
      { name: 'Bánh Mì Thịt', description: 'Crispy baguette, pâté, pickled vegetables' },
      { name: 'Bún Chả Hà Nội', description: 'Grilled pork patties, rice noodles, herbs' },
    ],
    chinese: [
      { name: 'Peking Duck', description: 'Crispy skin, hoisin sauce, steamed pancakes' },
      { name: 'Dim Sum Platter', description: "Chef's selection of steamed dumplings" },
      { name: 'Wok-Fried Lobster', description: 'Ginger scallion sauce, garlic noodles' },
    ],
    japanese: [
      { name: 'Omakase Selection', description: "Chef's choice of seasonal nigiri" },
      { name: 'Wagyu Tataki', description: 'A5 beef, ponzu, truffle' },
      { name: 'Signature Ramen', description: 'Tonkotsu broth, chashu, ajitama egg' },
    ],
    default: [
      { name: "Chef's Signature", description: 'Seasonal ingredients, artfully prepared' },
      { name: 'House Special', description: 'Our most beloved dish, perfected over years' },
      { name: 'Tasting Plate', description: 'A curated selection of our finest offerings' },
    ],
  };

  // Find matching menu items
  let items = menusByCategory.default;

  for (const [key, value] of Object.entries(menusByCategory)) {
    if (category.includes(key)) {
      items = value;
      break;
    }
  }

  return items.map((item) => ({
    ...item,
    price: getPrice(priceRange.min),
  }));
}

/**
 * Generate placeholder testimonials
 */
function generateTestimonials(crawlerOutput: CrawlerOutput): TemplateContent['testimonials'] {
  const reputationSnapshot = crawlerOutput.business_intelligence.reputation_snapshot;
  const coreIdentity = crawlerOutput.business_intelligence.core_identity;

  return {
    heading: 'What Our Guests Say',
    subheading: `${reputationSnapshot.average_rating} Stars on Google`,
    badge: reputationSnapshot.trust_badge_text,
    items: [
      {
        author: 'Sarah M.',
        text: `${coreIdentity.brand_display_name} exceeded all expectations. The flavors are incredible and the atmosphere is perfect.`,
        rating: 5,
      },
      {
        author: 'James L.',
        text: 'Best dining experience in the city. The attention to detail is remarkable.',
        rating: 5,
      },
      {
        author: 'Emily R.',
        text: "A hidden gem! We've been coming back every week since we discovered this place.",
        rating: 5,
      },
    ],
  };
}

/*
 * ============================================================================
 * Main Transformer Function
 * ============================================================================
 */

/**
 * Transform crawler output into template-ready content
 */
export function transformToTemplateContent(crawlerOutput: CrawlerOutput, themeId: RestaurantThemeId): TemplateContent {
  logger.info('Transforming crawler output to template content', { themeId });

  const businessIntelligence = crawlerOutput.business_intelligence;
  const brandStrategy = crawlerOutput.brand_strategy;
  const visualAssetStrategy = crawlerOutput.visual_asset_strategy;
  const coreIdentity = businessIntelligence.core_identity;
  const napLogistics = businessIntelligence.nap_logistics;
  const socialEcosystem = businessIntelligence.social_ecosystem;
  const industryContext = businessIntelligence.industry_context;

  const themeConfig = THEME_CONFIGS[themeId] || THEME_CONFIGS.artisanhearthv3;

  const content: TemplateContent = {
    seo: {
      title: `${coreIdentity.brand_display_name} | ${industryContext.primary_category}`,
      description: `${coreIdentity.tagline_inferred}. ${brandStrategy.inferred_usp}. Visit us at ${napLogistics.full_address}.`,
    },
    navigation: [
      { label: 'Home', path: '/' },
      { label: 'Menu', path: '/menu' },
      { label: 'Our Story', path: '/about' },
      { label: 'Gallery', path: '/gallery' },
      { label: 'Contact', path: '/contact' },
    ],
    hero: {
      eyebrow: generateEyebrow(themeConfig.eyebrowStyle, coreIdentity.brand_display_name),
      headline: generateHeadline(crawlerOutput),
      subheadline: generateSubheadline(crawlerOutput),
      cta: { label: themeConfig.heroCtaLabel, link: '/menu' },
    },
    about: {
      heading: themeConfig.aboutHeading,
      body: generateAboutBody(crawlerOutput),
      cta: { label: 'Read Our Story', link: '/about' },
    },
    menuHighlights: {
      heading: themeConfig.menuHeading,
      items: generateMenuItems(crawlerOutput),
      cta: { label: 'View Full Menu', link: '/menu' },
    },
    testimonials: generateTestimonials(crawlerOutput),
    contact: {
      address: napLogistics.full_address,
      phone: napLogistics.phone_clickable,
      bookingUrl: napLogistics.booking_action_url,
      serviceArea: napLogistics.service_area_text,
    },
    social: {
      facebook: socialEcosystem.facebook_url || undefined,
      instagram: socialEcosystem.instagram_url || undefined,
      whatsapp: socialEcosystem.whatsapp_number || undefined,
      tiktok: socialEcosystem.tiktok_url || undefined,
    },
    footer: {
      copyright: `© ${new Date().getFullYear()} ${coreIdentity.brand_display_name}. All rights reserved.`,
      tagline: coreIdentity.tagline_inferred,
    },
    brand: {
      name: coreIdentity.brand_display_name,
      tagline: coreIdentity.tagline_inferred,
      colors: {
        primary: visualAssetStrategy.color_palette_extracted.primary_hex,
        accent: visualAssetStrategy.color_palette_extracted.accent_hex,
      },
      isDarkMode: visualAssetStrategy.color_palette_extracted.is_dark_mode_suitable,
    },
  };

  logger.info('Content transformation complete', {
    themeId,
    brandName: content.brand.name,
    menuItemCount: content.menuHighlights.items.length,
  });

  return content;
}

/**
 * Serialize template content to JSON string for injection
 */
export function serializeContent(content: TemplateContent): string {
  return JSON.stringify(content, null, 2);
}

/**
 * Generate content.ts file content for template injection
 */
export function generateContentFileCode(content: TemplateContent): string {
  return `// Auto-generated content from business data
// Do not edit manually - regenerate through the website builder

export const siteContent = ${JSON.stringify(content, null, 2)};

export default siteContent;
`;
}

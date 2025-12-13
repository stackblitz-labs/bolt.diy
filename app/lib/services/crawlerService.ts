/**
 * Crawler Service
 * Provides business data from third-party crawler (mock implementation for now)
 *
 * @see docs/crawler-integration/production-schema.md
 */

import type { CrawlerDataPackage, CrawlerOutput } from '~/types/info-collection';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CrawlerService');

/*
 * ============================================================================
 * Cuisine Detection
 * ============================================================================
 */

type CuisineProfile = {
  category: string;
  priceTier: CrawlerOutput['business_intelligence']['industry_context']['price_tier'];
  toneOfVoice: string;
  visualStyle: string;
  typographyVibe: CrawlerOutput['visual_asset_strategy']['typography_vibe'];
  primaryColor: string;
  accentColor: string;
  isDarkMode: boolean;
  tagline: string;
  usp: string;
  targetAudience: string;
  highlights: string[];
};

const CUISINE_PROFILES: Record<string, CuisineProfile> = {
  italian: {
    category: 'Italian Restaurant',
    priceTier: 'Standard',
    toneOfVoice: 'Warm, Rustic, Authentic',
    visualStyle: 'Warm golden lighting, rustic brick textures, wood-fired aesthetics',
    typographyVibe: 'Serif_Elegant',
    primaryColor: '#8B4513',
    accentColor: '#D4AF37',
    isDarkMode: false,
    tagline: 'Authentic Taste of Italy',
    usp: 'Traditional family recipes passed down through generations',
    targetAudience: 'Families and couples seeking authentic Italian dining',
    highlights: ['Wood-Fired Oven', 'Fresh Pasta Daily', 'Family Recipes'],
  },
  vietnamese: {
    category: 'Vietnamese Restaurant',
    priceTier: 'Standard',
    toneOfVoice: 'Fresh, Vibrant, Authentic',
    visualStyle: 'Bright natural lighting, fresh herbs, street food energy',
    typographyVibe: 'Sans_Clean',
    primaryColor: '#2E7D32',
    accentColor: '#FF6F00',
    isDarkMode: false,
    tagline: 'Fresh Flavors of Vietnam',
    usp: 'Authentic pho and fresh ingredients daily',
    targetAudience: 'Health-conscious diners seeking fresh Asian cuisine',
    highlights: ['Fresh Herbs Daily', 'Authentic Pho', 'Family Owned'],
  },
  chinese: {
    category: 'Chinese Restaurant',
    priceTier: 'Standard',
    toneOfVoice: 'Energetic, Bold, Traditional',
    visualStyle: 'Red and gold accents, steam and motion, night market vibes',
    typographyVibe: 'Sans_Clean',
    primaryColor: '#C62828',
    accentColor: '#FFD700',
    isDarkMode: true,
    tagline: 'Taste the Tradition',
    usp: 'Wok-fired perfection with authentic regional flavors',
    targetAudience: 'Food enthusiasts seeking bold Asian flavors',
    highlights: ['Dim Sum', 'Wok Specialties', 'Family Style Dining'],
  },
  japanese: {
    category: 'Japanese Restaurant',
    priceTier: 'Premium',
    toneOfVoice: 'Refined, Precise, Zen',
    visualStyle: 'Minimalist, clean lines, natural materials',
    typographyVibe: 'Sans_Clean',
    primaryColor: '#1A237E',
    accentColor: '#E53935',
    isDarkMode: true,
    tagline: 'The Art of Japanese Cuisine',
    usp: 'Omakase-style dining with premium ingredients',
    targetAudience: 'Discerning diners appreciating culinary artistry',
    highlights: ['Fresh Sushi', 'Omakase Menu', 'Sake Selection'],
  },
  thai: {
    category: 'Thai Restaurant',
    priceTier: 'Standard',
    toneOfVoice: 'Vibrant, Spicy, Welcoming',
    visualStyle: 'Tropical colors, gold accents, exotic textures',
    typographyVibe: 'Display_Playful',
    primaryColor: '#7B1FA2',
    accentColor: '#FFB300',
    isDarkMode: false,
    tagline: 'Authentic Thai Flavors',
    usp: 'Traditional recipes with the perfect balance of spice',
    targetAudience: 'Adventurous eaters who love bold flavors',
    highlights: ['Fresh Curry', 'Pad Thai', 'Vegetarian Options'],
  },
  finedining: {
    category: 'Fine Dining Restaurant',
    priceTier: 'Luxury',
    toneOfVoice: 'Sophisticated, Elegant, Exclusive',
    visualStyle: 'Dark moody lighting, gold accents, dramatic presentation',
    typographyVibe: 'Serif_Elegant',
    primaryColor: '#1A1A1A',
    accentColor: '#D4AF37',
    isDarkMode: true,
    tagline: 'An Unforgettable Culinary Journey',
    usp: 'Michelin-quality tasting menus with wine pairings',
    targetAudience: 'Affluent diners seeking special occasion dining',
    highlights: ['Tasting Menu', 'Wine Pairing', 'Private Dining'],
  },
  american: {
    category: 'American Restaurant',
    priceTier: 'Standard',
    toneOfVoice: 'Casual, Friendly, Hearty',
    visualStyle: 'Warm wood tones, rustic charm, comfort food vibes',
    typographyVibe: 'Sans_Clean',
    primaryColor: '#5D4037',
    accentColor: '#FF5722',
    isDarkMode: false,
    tagline: 'Classic American Comfort',
    usp: 'Farm-to-table freshness with bold American flavors',
    targetAudience: 'Families and friends looking for hearty meals',
    highlights: ['Farm Fresh', 'Craft Beer', 'Outdoor Seating'],
  },
  fusion: {
    category: 'Fusion Restaurant',
    priceTier: 'Premium',
    toneOfVoice: 'Creative, Bold, Modern',
    visualStyle: 'Contemporary design, dramatic plating, artistic presentation',
    typographyVibe: 'Display_Playful',
    primaryColor: '#6A1B9A',
    accentColor: '#00BCD4',
    isDarkMode: true,
    tagline: 'Where Cuisines Collide',
    usp: 'Innovative fusion of global flavors and techniques',
    targetAudience: 'Adventurous foodies seeking unique culinary experiences',
    highlights: ['Tasting Menu', 'Craft Cocktails', "Chef's Table"],
  },
  cafe: {
    category: 'Café & Bistro',
    priceTier: 'Budget',
    toneOfVoice: 'Cozy, Friendly, Relaxed',
    visualStyle: 'Bright and airy, natural light, plants and greenery',
    typographyVibe: 'Sans_Clean',
    primaryColor: '#795548',
    accentColor: '#4CAF50',
    isDarkMode: false,
    tagline: 'Your Neighborhood Café',
    usp: 'Artisan coffee and fresh pastries in a cozy setting',
    targetAudience: 'Remote workers and casual diners',
    highlights: ['Artisan Coffee', 'Fresh Pastries', 'Free WiFi'],
  },
  seafood: {
    category: 'Seafood Restaurant',
    priceTier: 'Premium',
    toneOfVoice: 'Fresh, Coastal, Refined',
    visualStyle: 'Ocean blues, nautical elements, fresh catch imagery',
    typographyVibe: 'Serif_Elegant',
    primaryColor: '#0277BD',
    accentColor: '#FF8A65',
    isDarkMode: false,
    tagline: 'Fresh From the Sea',
    usp: 'Daily catch prepared with coastal tradition',
    targetAudience: 'Seafood lovers seeking premium ocean-to-table dining',
    highlights: ['Daily Fresh Catch', 'Raw Bar', 'Waterfront Dining'],
  },
};

/**
 * Detect cuisine type from user description
 */
function detectCuisine(description: string): string {
  const lowerDesc = description.toLowerCase();

  const cuisineKeywords: Record<string, string[]> = {
    vietnamese: ['vietnamese', 'pho', 'banh mi', 'vietnam', 'saigon'],
    chinese: ['chinese', 'dim sum', 'wok', 'szechuan', 'cantonese', 'noodle'],
    japanese: ['japanese', 'sushi', 'ramen', 'izakaya', 'omakase', 'sake'],
    thai: ['thai', 'pad thai', 'curry', 'bangkok', 'spicy thai'],
    italian: ['italian', 'pizza', 'pasta', 'trattoria', 'naples', 'rome'],
    finedining: ['fine dining', 'michelin', 'tasting menu', 'luxury', 'upscale', 'elegant'],
    american: ['american', 'burger', 'bbq', 'steakhouse', 'grill', 'farm-to-table'],
    fusion: ['fusion', 'modern', 'contemporary', 'innovative', 'creative'],
    cafe: ['cafe', 'café', 'coffee', 'bistro', 'brunch', 'bakery'],
    seafood: ['seafood', 'fish', 'oyster', 'lobster', 'crab', 'coastal'],
  };

  for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
    if (keywords.some((keyword) => lowerDesc.includes(keyword))) {
      return cuisine;
    }
  }

  // Default to italian as a safe fallback
  return 'italian';
}

/**
 * Extract business name from description or generate a placeholder
 */
function extractBusinessName(description: string): { legal: string; display: string } {
  // Try to find quoted names or "called X" patterns
  const quotedMatch = description.match(/["']([^"']+)["']/);

  if (quotedMatch) {
    return { legal: `${quotedMatch[1]} LLC`, display: quotedMatch[1] };
  }

  const calledMatch = description.match(/called\s+([A-Z][a-zA-Z\s]+)/i);

  if (calledMatch) {
    return { legal: `${calledMatch[1].trim()} LLC`, display: calledMatch[1].trim() };
  }

  const namedMatch = description.match(/named\s+([A-Z][a-zA-Z\s]+)/i);

  if (namedMatch) {
    return { legal: `${namedMatch[1].trim()} LLC`, display: namedMatch[1].trim() };
  }

  // Generate placeholder based on cuisine
  const cuisine = detectCuisine(description);
  const placeholders: Record<string, string> = {
    vietnamese: 'Saigon Kitchen',
    chinese: 'Golden Dragon',
    japanese: 'Sakura House',
    thai: 'Thai Orchid',
    italian: 'Bella Napoli',
    finedining: 'The Grand Table',
    american: 'The Local Kitchen',
    fusion: 'Fusion 88',
    cafe: 'The Corner Café',
    seafood: 'Ocean Blue',
  };

  const displayName = placeholders[cuisine] || 'The Restaurant';

  return { legal: `${displayName} LLC`, display: displayName };
}

/*
 * ============================================================================
 * Mock Crawler Service
 * ============================================================================
 */

/**
 * Get mock crawler data based on session info
 * TODO: Replace with real third-party crawler API when ready
 */
export async function getMockCrawlerData(dataPackage: CrawlerDataPackage): Promise<CrawlerOutput> {
  logger.info('Generating mock crawler data', {
    sessionId: dataPackage.sessionId,
    hasWebsite: !!dataPackage.websiteUrl,
    hasGoogleMaps: !!dataPackage.googleMapsUrl,
  });

  const description = dataPackage.userDescription;
  const cuisine = detectCuisine(description);
  const profile = CUISINE_PROFILES[cuisine];
  const businessName = extractBusinessName(description);

  logger.debug('Detected cuisine profile', { cuisine, businessName: businessName.display });

  const crawlerOutput: CrawlerOutput = {
    business_intelligence: {
      core_identity: {
        legal_name: businessName.legal,
        brand_display_name: businessName.display,
        tagline_inferred: profile.tagline,
      },
      industry_context: {
        primary_category: profile.category,
        price_tier: profile.priceTier,
        catalog_type: 'Menu_Food_Drink',
        operational_highlights: profile.highlights,
      },
      nap_logistics: {
        full_address: '123 Main Street, City, State 12345',
        phone_clickable: '+1-555-123-4567',
        booking_action_url: '/reservations',
        service_area_text: 'Serving the Greater Metro Area',
      },
      social_ecosystem: {
        facebook_url: `https://facebook.com/${businessName.display.toLowerCase().replace(/\s+/g, '')}`,
        instagram_url: `https://instagram.com/${businessName.display.toLowerCase().replace(/\s+/g, '')}`,
        whatsapp_number: null,
        linkedin_url: null,
        tiktok_url: null,
      },
      reputation_snapshot: {
        total_reviews: Math.floor(Math.random() * 200) + 50,
        average_rating: Number((Math.random() * 0.5 + 4.3).toFixed(1)),
        trust_badge_text: '4.5+ Stars on Google',
      },
    },
    brand_strategy: {
      inferred_usp: profile.usp,
      target_audience_persona: profile.targetAudience,
      tone_of_voice: profile.toneOfVoice,
      visual_style_prompt: profile.visualStyle,
    },
    visual_asset_strategy: {
      color_palette_extracted: {
        primary_hex: profile.primaryColor,
        accent_hex: profile.accentColor,
        is_dark_mode_suitable: profile.isDarkMode,
      },
      typography_vibe: profile.typographyVibe,
    },
  };

  logger.info('Mock crawler data generated successfully', {
    sessionId: dataPackage.sessionId,
    category: crawlerOutput.business_intelligence.industry_context.primary_category,
  });

  return crawlerOutput;
}

/**
 * Future: Call real third-party crawler service
 */
export async function getCrawlerData(dataPackage: CrawlerDataPackage): Promise<CrawlerOutput> {
  /*
   * For now, use mock data
   * TODO: Implement real crawler API call here
   */
  return getMockCrawlerData(dataPackage);
}

/*
 * Crawler API Types
 * Generated from specs/001-crawler-api-integration/data-model.md
 */

export type CrawlSessionStatus = 'pending' | 'crawling' | 'completed' | 'failed' | 'timeout';

export interface CrawlSession {
  session_id: string;
  google_maps_url: string;
  status: CrawlSessionStatus;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface CrawlRequest {
  session_id: string;
  google_maps_url?: string;
  business_name?: string;
  address?: string;
  website_url?: string;
  place_id?: string;
}

export interface CrawlResponse {
  success: boolean;
  data?: BusinessData;
  error?: string;
  statusCode?: number; // Track HTTP status from crawler API
}

export interface BusinessData {
  name?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews_count?: number;
  hours?: Record<string, string>;
  reviews?: Review[];
  menu?: Menu;
  photos?: Photo[];
}

export interface Review {
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface Menu {
  categories: MenuCategory[];
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface MenuItem {
  name: string;
  price?: string;
  description?: string;
}

export interface Photo {
  url: string;
  type?: string;
}

export interface GenerateContentRequest {
  session_id: string;
}

export interface GenerateContentResponse {
  success: boolean;
  session_id: string;
  data?: GeneratedContent;
  error?: string;
  statusCode?: number; // Track HTTP status from crawler API
}

export interface GeneratedContent {
  brandStrategy: BrandStrategy;
  visualAssets: VisualAssets;
  businessIdentity: BusinessIdentity;
  industryContext: IndustryContext;
  reputationData?: ReputationData;
  contentSections: ContentSections;
  extractedData?: ExtractedData;
}

export interface BrandStrategy {
  usp: string;
  targetAudience: string;
  toneOfVoice: string;
  visualStyle: string;
}

export interface VisualAssets {
  colorPalette: ColorPalette;
  typography: Typography;
  logo?: Logo;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string[];
  text: string[];
}

export interface Typography {
  headingFont: string;
  bodyFont: string;
  allFonts?: string[];
}

export interface Logo {
  url: string;
  source: string;
  description?: string;
}

export interface BusinessIdentity {
  legalName?: string;
  displayName: string;
  tagline: string;
  description: string;
}

export interface IndustryContext {
  categories: string[];
  pricingTier?: string;
  operationalHighlights?: string[];
}

export interface ReputationData {
  reviewsCount: number;
  averageRating: number;
  trustBadges?: string[];
}

export interface ContentSections {
  hero?: HeroSection;
  about?: AboutSection;
  products?: ProductsSection;
  [key: string]: GenericSection | undefined;
}

export interface HeroSection {
  heading: string;
  subheading?: string;
  images?: string[];
}

export interface AboutSection {
  heading: string;
  content: string;
  images?: string[];
}

export interface ProductsSection {
  heading: string;
  items: ProductItem[];
}

export interface ProductItem {
  name: string;
  description?: string;
  image?: string;
}

export interface GenericSection {
  heading?: string;
  content?: string;
  images?: string[];
}

export interface ExtractedData {
  allImages?: string[];
  instagramPosts?: unknown[];
  websiteUrl?: string;
  pagesAnalyzed?: number;
}

export interface SearchRestaurantRequest {
  business_name: string;
  address: string;
}

export interface VerifiedRestaurantData {
  name: string;
  place_id: string;
  data_id: string;
  address: string;
  phone?: string;
  website?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    zoom?: number;
  };
}

export interface SearchRestaurantResponse {
  success: boolean;
  data?: VerifiedRestaurantData;
  error?: string;
  statusCode?: number;
}

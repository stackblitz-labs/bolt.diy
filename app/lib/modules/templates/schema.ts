/**
 * Template and MasterContent Zod Schemas
 *
 * Defines strict typings and validation for restaurant website templates
 * and the Master Content JSON exchanged between agents.
 *
 * Based on specs/001-phase1-plan/data-model.md
 */

import { z } from 'zod';

// ============================================================================
// DESIGN SYSTEM SCHEMA
// ============================================================================

export const DesignSystemSchema = z.object({
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Primary color must be a valid hex color'),
  secondary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Secondary color must be a valid hex color'),
  accent_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Accent color must be a valid hex color'),
  font_family: z.string().min(1, 'Font family is required'),
});

export type DesignSystem = z.infer<typeof DesignSystemSchema>;

// ============================================================================
// CONTACT INFO SCHEMA
// ============================================================================

export const ContactInfoSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export type ContactInfo = z.infer<typeof ContactInfoSchema>;

// ============================================================================
// ADDRESS SCHEMA
// ============================================================================

export const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
});

export type Address = z.infer<typeof AddressSchema>;

// ============================================================================
// HOURS OF OPERATION SCHEMA
// ============================================================================

export const HoursEntrySchema = z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Open time must be in HH:MM format'),
  close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Close time must be in HH:MM format'),
});

export const HoursOfOperationSchema = z.array(HoursEntrySchema);

export type HoursEntry = z.infer<typeof HoursEntrySchema>;
export type HoursOfOperation = z.infer<typeof HoursOfOperationSchema>;

// ============================================================================
// MENU SCHEMA
// ============================================================================

export const MenuItemSchema = z.object({
  name: z.string().min(1, 'Menu item name is required'),
  price: z.number().positive('Price must be positive'),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  currency: z.string().default('USD'),
});

export const MenuCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  items: z.array(MenuItemSchema),
});

export const MenuSchema = z.array(MenuCategorySchema);

export type MenuItem = z.infer<typeof MenuItemSchema>;
export type MenuCategory = z.infer<typeof MenuCategorySchema>;
export type Menu = z.infer<typeof MenuSchema>;

// ============================================================================
// GALLERY SCHEMA
// ============================================================================

export const GalleryImageSchema = z.object({
  url: z.string().url('Image URL must be valid'),
  alt_text: z.string().min(1, 'Alt text is required for accessibility'),
});

export const GallerySchema = z.array(GalleryImageSchema).max(20, 'Maximum 20 gallery images allowed');

export type GalleryImage = z.infer<typeof GalleryImageSchema>;
export type Gallery = z.infer<typeof GallerySchema>;

// ============================================================================
// TESTIMONIAL SCHEMA
// ============================================================================

export const TestimonialSchema = z.object({
  quote: z.string().min(1, 'Quote is required'),
  author: z.string().min(1, 'Author is required'),
  rating: z.number().int().min(1).max(5).optional(),
  source_url: z.string().url().optional(),
});

export const TestimonialsSchema = z.array(TestimonialSchema).max(50, 'Maximum 50 testimonials allowed');

export type Testimonial = z.infer<typeof TestimonialSchema>;
export type Testimonials = z.infer<typeof TestimonialsSchema>;

// ============================================================================
// AI GENERATED COPY SCHEMA
// ============================================================================

export const AIGeneratedCopySchema = z.object({
  hero: z.string().min(10, 'Hero copy must be at least 10 characters'),
  about: z.string().min(10, 'About copy must be at least 10 characters'),
  cta: z.string().min(1, 'CTA text is required'),
  testimonials_intro: z.string().optional(),
});

export type AIGeneratedCopy = z.infer<typeof AIGeneratedCopySchema>;

// ============================================================================
// AI EXTRACTED THEMES SCHEMA
// ============================================================================

export const AIExtractedThemesSchema = z.object({
  themes: z.array(z.string()),
  popular_dishes: z.array(z.string()),
});

export type AIExtractedThemes = z.infer<typeof AIExtractedThemesSchema>;

// ============================================================================
// BUSINESS PROFILE SCHEMA
// ============================================================================

export const BusinessProfileSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  google_place_id: z.string().optional(),
  gmaps_url: z.string().url('Google Maps URL must be valid'),
  logo_url: z.string().url().optional(),
  contact_info: ContactInfoSchema,
  address: AddressSchema,
  hours_of_operation: HoursOfOperationSchema,
  ai_generated_copy: AIGeneratedCopySchema,
  ai_extracted_themes: AIExtractedThemesSchema.optional(),
  menu: MenuSchema,
  gallery_images: GallerySchema,
  testimonials: TestimonialsSchema,
  design_system: DesignSystemSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

// ============================================================================
// TEMPLATE METADATA SCHEMA
// ============================================================================

export const TemplateMetadataSchema = z.object({
  id: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().min(10, 'Template description must be at least 10 characters'),
  tone: z.array(z.string()).min(1, 'At least one tone tag is required'),
  requiredSections: z.array(z.string()).min(1, 'At least one required section must be specified'),
  preview_url: z.string().url().optional(),
  created_at: z.string().datetime(),
});

export type TemplateMetadata = z.infer<typeof TemplateMetadataSchema>;

// ============================================================================
// TEMPLATE REGISTRY SCHEMA
// ============================================================================

export const TemplateRegistrySchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver format'),
  templates: z.array(TemplateMetadataSchema),
});

export type TemplateRegistry = z.infer<typeof TemplateRegistrySchema>;

// ============================================================================
// MASTER CONTENT SCHEMA
// ============================================================================

export const HeroCopySchema = z.object({
  headline: z.string().min(1, 'Headline is required'),
  subheadline: z.string().min(1, 'Subheadline is required'),
  cta_label: z.string().min(1, 'CTA label is required'),
});

export const SectionContentSchema = z.object({
  about: z.string().min(10, 'About section must be at least 10 characters'),
  menu_intro: z.string().optional(),
  testimonials_intro: z.string().optional(),
});

export const HeroImageSchema = z.object({
  url: z.string().url('Hero image URL must be valid'),
  alt_text: z.string().min(1, 'Alt text is required'),
  source: z.enum(['generated', 'provided', 'stock']),
});

export const MasterContentMetadataSchema = z.object({
  crawl_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  generated_at: z.string().datetime(),
});

export const MasterContentSchema = z.object({
  tenant_id: z.string().uuid(),
  template_id: z.string().min(1, 'Template ID is required'),
  brand_summary: z
    .string()
    .min(50, 'Brand summary must be at least 50 characters')
    .max(1000, 'Brand summary must not exceed 1000 characters'),
  hero_copy: HeroCopySchema,
  sections: SectionContentSchema,
  menu_items: z.array(MenuItemSchema),
  testimonials: z.array(TestimonialSchema),
  design_tokens: DesignSystemSchema,
  hero_image: HeroImageSchema,
  metadata: MasterContentMetadataSchema,
});

export type HeroCopy = z.infer<typeof HeroCopySchema>;
export type SectionContent = z.infer<typeof SectionContentSchema>;
export type HeroImage = z.infer<typeof HeroImageSchema>;
export type MasterContentMetadata = z.infer<typeof MasterContentMetadataSchema>;
export type MasterContent = z.infer<typeof MasterContentSchema>;

// ============================================================================
// COMMAND INTENT SCHEMA
// ============================================================================

export const CommandIntentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  command_type: z.enum(['update_file', 'insert_block', 'replace_color', 'fallback_form']),
  file_path: z.string().min(1, 'File path is required'),
  json_path: z.string().min(1, 'JSON path is required'),
  proposed_value: z.any(), // Can be any JSON value
  confidence: z.number().min(0).max(1),
  submitted_at: z.string().datetime(),
  status: z.enum(['pending', 'applied', 'rejected']),
});

export type CommandIntent = z.infer<typeof CommandIntentSchema>;

// ============================================================================
// SITE SNAPSHOT SCHEMA
// ============================================================================

export const SiteSnapshotSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  business_profile_id: z.string().uuid(),
  template_id: z.string().min(1, 'Template ID is required'),
  workspace_archive_url: z.string().url('Archive URL must be valid HTTPS').startsWith('https://'),
  version_label: z.string().min(1).max(255, 'Version label must not exceed 255 characters'),
  created_at: z.string().datetime(),
});

export type SiteSnapshot = z.infer<typeof SiteSnapshotSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates and parses template metadata from JSON
 */
export function validateTemplateMetadata(data: unknown): TemplateMetadata {
  return TemplateMetadataSchema.parse(data);
}

/**
 * Validates and parses template registry from JSON
 */
export function validateTemplateRegistry(data: unknown): TemplateRegistry {
  return TemplateRegistrySchema.parse(data);
}

/**
 * Validates and parses Master Content from JSON
 */
export function validateMasterContent(data: unknown): MasterContent {
  return MasterContentSchema.parse(data);
}

/**
 * Validates and parses Business Profile from JSON
 */
export function validateBusinessProfile(data: unknown): BusinessProfile {
  return BusinessProfileSchema.parse(data);
}

/**
 * Validates and parses Command Intent from JSON
 */
export function validateCommandIntent(data: unknown): CommandIntent {
  return CommandIntentSchema.parse(data);
}

/**
 * Validates and parses Site Snapshot from JSON
 */
export function validateSiteSnapshot(data: unknown): SiteSnapshot {
  return SiteSnapshotSchema.parse(data);
}

// ============================================================================
// SCHEMA EXPORT FOR EXTERNAL VALIDATION
// ============================================================================

export const Schemas = {
  DesignSystem: DesignSystemSchema,
  ContactInfo: ContactInfoSchema,
  Address: AddressSchema,
  HoursEntry: HoursEntrySchema,
  HoursOfOperation: HoursOfOperationSchema,
  MenuItem: MenuItemSchema,
  MenuCategory: MenuCategorySchema,
  Menu: MenuSchema,
  GalleryImage: GalleryImageSchema,
  Gallery: GallerySchema,
  Testimonial: TestimonialSchema,
  Testimonials: TestimonialsSchema,
  AIGeneratedCopy: AIGeneratedCopySchema,
  AIExtractedThemes: AIExtractedThemesSchema,
  BusinessProfile: BusinessProfileSchema,
  TemplateMetadata: TemplateMetadataSchema,
  TemplateRegistry: TemplateRegistrySchema,
  MasterContent: MasterContentSchema,
  CommandIntent: CommandIntentSchema,
  SiteSnapshot: SiteSnapshotSchema,
} as const;

/**
 * Restaurant Theme Types
 *
 * Type definitions for the restaurant theme system that provides
 * domain-specific design guidance for restaurant website generation.
 */

/**
 * A string literal union representing valid restaurant theme identifiers.
 * These correspond to the 12 existing theme prompt files in app/theme-prompts/
 */
export type RestaurantThemeId =
  | 'artisanhearthv3'
  | 'bamboobistro'
  | 'boldfeastv2'
  | 'chromaticstreet'
  | 'classicminimalistv2'
  | 'dynamicfusion'
  | 'freshmarket'
  | 'gastrobotanical'
  | 'indochineluxe'
  | 'noirluxev3'
  | 'saigonveranda'
  | 'therednoodle';

/**
 * Represents a complete restaurant theme with metadata and prompt content.
 */
export interface RestaurantTheme {
  /** Unique theme identifier */
  id: RestaurantThemeId;

  /** Human-readable display name */
  label: string;

  /** Brief theme description */
  description: string;

  /** Cuisine types this theme suits (e.g., 'asian', 'vietnamese') */
  cuisines: string[];

  /** Style descriptors (e.g., 'casual', 'fine-dining') */
  styleTags: string[];

  /** Must match STARTER_TEMPLATES[].name exactly */
  templateName: string;

  /** Raw markdown content from theme file */
  prompt: string;
}

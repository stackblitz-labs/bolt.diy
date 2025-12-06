import type { RestaurantThemeId } from './restaurant-theme';

export interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  tags?: string[];
  icon?: string;

  /** Template category - 'generic' for existing templates, 'restaurant' for restaurant-specific templates */
  category?: 'generic' | 'restaurant';

  /** Associated restaurant theme ID - only set for restaurant templates */
  restaurantThemeId?: RestaurantThemeId;
}

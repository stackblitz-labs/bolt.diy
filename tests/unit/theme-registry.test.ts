/**
 * Unit Tests for Restaurant Theme Registry
 *
 * Tests the theme registry utility functions to ensure proper
 * theme lookup, prompt retrieval, and data consistency.
 */

import { describe, it, expect } from 'vitest';
import type { RestaurantThemeId } from '~/types/restaurant-theme';
import {
  getThemeById,
  getThemeByTemplateName,
  getThemePrompt,
  getThemeList,
  RESTAURANT_THEMES,
} from '~/theme-prompts/registry';

describe('Restaurant Theme Registry', () => {
  describe('RESTAURANT_THEMES', () => {
    it('should contain exactly 12 themes', () => {
      expect(RESTAURANT_THEMES).toHaveLength(12);
    });

    it('should have unique theme IDs', () => {
      const ids = RESTAURANT_THEMES.map(theme => theme.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(12);
    });

    it('should have unique template names', () => {
      const templateNames = RESTAURANT_THEMES.map(theme => theme.templateName);
      const uniqueTemplateNames = new Set(templateNames);
      expect(uniqueTemplateNames.size).toBe(12);
    });

    it('should have valid theme IDs', () => {
      const validIds: RestaurantThemeId[] = [
        'artisanhearthv3',
        'bamboobistro',
        'boldfeastv2',
        'chromaticstreet',
        'classicminimalistv2',
        'dynamicfusion',
        'freshmarket',
        'gastrobotanical',
        'indochineluxe',
        'noirluxev3',
        'saigonveranda',
        'therednoodle',
      ];

      RESTAURANT_THEMES.forEach(theme => {
        expect(validIds).toContain(theme.id);
      });
    });

    it('should have non-empty prompts for all themes', () => {
      RESTAURANT_THEMES.forEach(theme => {
        expect(theme.prompt).toBeDefined();
        expect(typeof theme.prompt).toBe('string');
        expect(theme.prompt.length).toBeGreaterThan(0);
      });
    });

    it('should have required fields for all themes', () => {
      RESTAURANT_THEMES.forEach(theme => {
        expect(theme.id).toBeDefined();
        expect(theme.label).toBeDefined();
        expect(theme.description).toBeDefined();
        expect(theme.cuisines).toBeDefined();
        expect(theme.styleTags).toBeDefined();
        expect(theme.templateName).toBeDefined();
        expect(theme.prompt).toBeDefined();

        expect(Array.isArray(theme.cuisines)).toBe(true);
        expect(Array.isArray(theme.styleTags)).toBe(true);
        expect(theme.cuisines.length).toBeGreaterThan(0);
        expect(theme.styleTags.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getThemeById', () => {
    it('should return correct theme for valid ID', () => {
      const theme = getThemeById('bamboobistro');
      expect(theme).toBeDefined();
      expect(theme?.id).toBe('bamboobistro');
      expect(theme?.label).toBe('The Bamboo Bistro');
      expect(theme?.templateName).toBe('Bamboo Bistro');
    });

    it('should return undefined for invalid ID', () => {
      const theme = getThemeById('invalid-id' as RestaurantThemeId);
      expect(theme).toBeUndefined();
    });

    it('should return theme with all expected properties', () => {
      const theme = getThemeById('noirluxev3');
      expect(theme).toBeDefined();
      expect(theme?.id).toBe('noirluxev3');
      expect(theme?.label).toBe('Noir Luxe v3');
      expect(typeof theme?.description).toBe('string');
      expect(Array.isArray(theme?.cuisines)).toBe(true);
      expect(Array.isArray(theme?.styleTags)).toBe(true);
      expect(typeof theme?.templateName).toBe('string');
      expect(typeof theme?.prompt).toBe('string');
    });
  });

  describe('getThemeByTemplateName', () => {
    it('should return correct theme for valid template name', () => {
      const theme = getThemeByTemplateName('Bamboo Bistro');
      expect(theme).toBeDefined();
      expect(theme?.id).toBe('bamboobistro');
      expect(theme?.templateName).toBe('Bamboo Bistro');
    });

    it('should return undefined for invalid template name', () => {
      const theme = getThemeByTemplateName('Invalid Template');
      expect(theme).toBeUndefined();
    });

    it('should be case-sensitive', () => {
      const theme1 = getThemeByTemplateName('Bamboo Bistro');
      const theme2 = getThemeByTemplateName('bamboo bistro');
      expect(theme1).toBeDefined();
      expect(theme2).toBeUndefined();
    });

    it('should match exactly with template names in constants', () => {
      const templateNames = [
        'Artisan Hearth v3',
        'Bamboo Bistro',
        'Bold Feast v2',
        'Chromatic Street',
        'Classic Minimalist v2',
        'Dynamic Fusion',
        'Fresh Market',
        'Gastrobotanical',
        'Indochine Luxe',
        'Noir Luxe v3',
        'Saigon Veranda',
        'The Red Noodle',
      ];

      templateNames.forEach(templateName => {
        const theme = getThemeByTemplateName(templateName);
        expect(theme).toBeDefined();
        expect(theme?.templateName).toBe(templateName);
      });
    });
  });

  describe('getThemePrompt', () => {
    it('should return prompt content for valid theme ID', () => {
      const prompt = getThemePrompt('bamboobistro');
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt!.length).toBeGreaterThan(0);
      expect(prompt).toContain('Bamboo'); // Theme-specific content (case-sensitive)
    });

    it('should return null for invalid theme ID', () => {
      const prompt = getThemePrompt('invalid-id' as RestaurantThemeId);
      expect(prompt).toBeNull();
    });

    it('should return different prompts for different themes', () => {
      const prompt1 = getThemePrompt('bamboobistro');
      const prompt2 = getThemePrompt('noirluxev3');
      expect(prompt1).not.toBe(prompt2);
    });

    it('should return prompts with markdown formatting', () => {
      const prompt = getThemePrompt('freshmarket');
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      // Most theme prompts should have markdown headers
      expect(prompt).toMatch(/#+\s*\w+/);
    });
  });

  describe('getThemeList', () => {
    it('should return array with 12 themes', () => {
      const themeList = getThemeList();
      expect(themeList).toHaveLength(12);
    });

    it('should return array with expected structure', () => {
      const themeList = getThemeList();
      themeList.forEach(theme => {
        expect(theme).toHaveProperty('id');
        expect(theme).toHaveProperty('label');
        expect(theme).toHaveProperty('cuisines');

        expect(typeof theme.id).toBe('string');
        expect(typeof theme.label).toBe('string');
        expect(Array.isArray(theme.cuisines)).toBe(true);
        expect(theme.cuisines.length).toBeGreaterThan(0);
      });
    });

    it('should not include prompt content in list', () => {
      const themeList = getThemeList();
      themeList.forEach(theme => {
        expect(theme).not.toHaveProperty('prompt');
        expect(theme).not.toHaveProperty('description');
        expect(theme).not.toHaveProperty('styleTags');
        expect(theme).not.toHaveProperty('templateName');
      });
    });

    it('should include all theme IDs', () => {
      const themeList = getThemeList();
      const themeIds = themeList.map(theme => theme.id);
      const expectedIds: RestaurantThemeId[] = [
        'artisanhearthv3',
        'bamboobistro',
        'boldfeastv2',
        'chromaticstreet',
        'classicminimalistv2',
        'dynamicfusion',
        'freshmarket',
        'gastrobotanical',
        'indochineluxe',
        'noirluxev3',
        'saigonveranda',
        'therednoodle',
      ];

      expectedIds.forEach(expectedId => {
        expect(themeIds).toContain(expectedId);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should maintain consistency between lookup methods', () => {
      const themeById = getThemeById('bamboobistro');
      const themeByTemplate = getThemeByTemplateName('Bamboo Bistro');

      expect(themeById).toBeDefined();
      expect(themeByTemplate).toBeDefined();
      expect(themeById).toEqual(themeByTemplate);
    });

    it('should have matching IDs between registry and constants', () => {
      // This tests the integration between registry and constants
      const registryThemeIds = RESTAURANT_THEMES.map(theme => theme.id);
      const expectedIds: RestaurantThemeId[] = [
        'artisanhearthv3',
        'bamboobistro',
        'boldfeastv2',
        'chromaticstreet',
        'classicminimalistv2',
        'dynamicfusion',
        'freshmarket',
        'gastrobotanical',
        'indochineluxe',
        'noirluxev3',
        'saigonveranda',
        'therednoodle',
      ];

      expect(registryThemeIds.sort()).toEqual(expectedIds.sort());
    });
  });
});
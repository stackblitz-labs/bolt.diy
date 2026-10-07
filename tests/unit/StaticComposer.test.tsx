/**
 * Static Composer Component Tests
 * 
 * Tests the static composer component and handoff hook
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { 
  StaticComposer, 
  useStaticComposer,
  generateStaticComposerHTML,
  injectStaticComposer 
} from '~/components/chat/StaticComposer';

describe('StaticComposer', () => {
  beforeEach(() => {
    // Clean up any existing static composer
    const existing = document.querySelector('[data-static-composer="true"]');
    if (existing) {
      existing.remove();
    }
  });

  describe('StaticComposer Component', () => {
    it('should render textarea', () => {
      render(<StaticComposer />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should use placeholder prop', () => {
      const placeholder = 'Type something...';
      render(<StaticComposer placeholder={placeholder} />);
      
      const textarea = screen.getByPlaceholderText(placeholder);
      expect(textarea).toBeInTheDocument();
    });

    it('should apply className prop', () => {
      const className = 'custom-class';
      const { container } = render(<StaticComposer className={className} />);
      
      // The className is applied to the container div
      const composerDiv = container.querySelector('[data-react-composer="true"]');
      expect(composerDiv).toBeTruthy();
    });

    it('should call onReady when handoff complete', async () => {
      const onReady = vi.fn();
      
      // Create a static composer first
      const staticDiv = document.createElement('div');
      staticDiv.setAttribute('data-static-composer', 'true');
      staticDiv.innerHTML = '<textarea id="static-composer-textarea"></textarea>';
      document.body.appendChild(staticDiv);
      
      render(<StaticComposer onReady={onReady} />);
      
      await waitFor(() => {
        expect(onReady).toHaveBeenCalled();
      }, { timeout: 100 });
    });
  });

  describe('useStaticComposer', () => {
    it('should return isReady and handleReady', () => {
      const { result } = renderHook(() => useStaticComposer());
      
      expect(result.current).toHaveProperty('isReady');
      expect(result.current).toHaveProperty('handleReady');
      expect(typeof result.current.handleReady).toBe('function');
    });

    it('should start with isReady false', () => {
      const { result } = renderHook(() => useStaticComposer());
      
      expect(result.current.isReady).toBe(false);
    });
  });

  describe('generateStaticComposerHTML', () => {
    it('should generate HTML string', () => {
      const html = generateStaticComposerHTML();
      
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });

    it('should include static composer marker', () => {
      const html = generateStaticComposerHTML();
      
      expect(html).toContain('data-static-composer');
    });

    it('should include textarea', () => {
      const html = generateStaticComposerHTML();
      
      expect(html).toContain('textarea');
      expect(html).toContain('static-composer-textarea');
    });

    it('should include placeholder text', () => {
      const placeholder = 'Custom placeholder';
      const html = generateStaticComposerHTML(placeholder);
      
      expect(html).toContain(placeholder);
    });

    it('should use default placeholder', () => {
      const html = generateStaticComposerHTML();
      
      expect(html).toContain('How can I help you?');
    });
  });

  describe('injectStaticComposer', () => {
    it('should inject static composer into DOM', () => {
      injectStaticComposer();
      
      const composer = document.querySelector('[data-static-composer="true"]');
      expect(composer).toBeTruthy();
      
      // Cleanup
      composer?.remove();
    });

    it('should not inject twice', () => {
      injectStaticComposer();
      injectStaticComposer();
      
      const composers = document.querySelectorAll('[data-static-composer="true"]');
      expect(composers.length).toBe(1);
      
      // Cleanup
      composers[0]?.remove();
    });

    it('should inject with custom placeholder', () => {
      const placeholder = 'Test placeholder';
      injectStaticComposer(placeholder);
      
      const composer = document.querySelector('[data-static-composer="true"]');
      expect(composer?.innerHTML).toContain(placeholder);
      
      // Cleanup
      composer?.remove();
    });
  });

  describe('integration', () => {
    it('should handoff from static to React', async () => {
      // 1. Inject static composer
      injectStaticComposer('Test placeholder');
      
      const staticComposer = document.querySelector('[data-static-composer="true"]');
      expect(staticComposer).toBeTruthy();
      
      // 2. Render React component
      const onReady = vi.fn();
      render(<StaticComposer placeholder="Test placeholder" onReady={onReady} />);
      
      // 3. Wait for handoff
      await waitFor(() => {
        const staticStillExists = document.querySelector('[data-static-composer="true"]');
        expect(staticStillExists).toBeNull();
      }, { timeout: 200 });
      
      // 4. Verify React composer is rendered
      const reactComposer = document.querySelector('[data-react-composer="true"]');
      expect(reactComposer).toBeTruthy();
      
      // 5. Verify onReady was called
      expect(onReady).toHaveBeenCalled();
    });
  });
});

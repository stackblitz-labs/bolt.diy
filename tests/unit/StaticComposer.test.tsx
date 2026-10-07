/**
 * Static Composer Component Tests
 * 
 * Tests the static composer component and handoff hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { 
  StaticComposerFallback, 
  useStaticComposerHandoff,
  generateStaticComposerHTML 
} from '~/components/chat/StaticComposer';

describe('StaticComposer', () => {
  describe('StaticComposerFallback', () => {
    it('should render textarea', () => {
      render(<StaticComposerFallback />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should use placeholder prop', () => {
      const placeholder = 'Type something...';
      render(<StaticComposerFallback placeholder={placeholder} />);
      
      const textarea = screen.getByPlaceholderText(placeholder);
      expect(textarea).toBeInTheDocument();
    });

    it('should handle input changes', async () => {
      const onInput = vi.fn();
      render(<StaticComposerFallback onInput={onInput} />);
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      // Use React's onChange by setting value and calling the handler
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      
      nativeInputValueSetter?.call(textarea, 'test input');
      
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);
      
      await waitFor(() => {
        expect(onInput).toHaveBeenCalled();
      });
    });

    it('should apply className prop', () => {
      const className = 'custom-class';
      const { container } = render(<StaticComposerFallback className={className} />);
      
      expect(container.firstChild).toHaveClass(className);
    });

    it('should have autoFocus attribute', () => {
      render(<StaticComposerFallback />);
      
      const textarea = screen.getByRole('textbox');
      // Check for the React autoFocus prop in the element
      expect(textarea.hasAttribute('autofocus') || document.activeElement === textarea).toBe(true);
    });
  });

  describe('useStaticComposerHandoff', () => {
    beforeEach(() => {
      // Clean up global state before each test
      delete (window as any).__boltStaticInput;
      const staticElement = document.getElementById('bolt-static-composer');
      if (staticElement) {
        staticElement.remove();
      }
    });

    it('should return initial value when no early input', () => {
      const { result } = renderHook(() => useStaticComposerHandoff());
      
      const [value] = result.current;
      expect(value).toBe('');
    });

    it('should return custom initial value', () => {
      const { result } = renderHook(() => useStaticComposerHandoff('default text'));
      
      const [value] = result.current;
      expect(value).toBe('default text');
    });

    it('should capture early input from global', () => {
      (window as any).__boltStaticInput = 'early input text';
      
      const { result } = renderHook(() => useStaticComposerHandoff());
      
      const [value] = result.current;
      expect(value).toBe('early input text');
    });

    it('should clean up global after handoff', () => {
      (window as any).__boltStaticInput = 'test';
      
      renderHook(() => useStaticComposerHandoff());
      
      expect((window as any).__boltStaticInput).toBeUndefined();
    });

    it('should remove static composer element when window property exists', async () => {
      // Set up both the DOM element and the window property
      const div = document.createElement('div');
      div.id = 'bolt-static-composer';
      document.body.appendChild(div);
      
      (window as any).__boltStaticInput = 'test input';
      
      // Verify element exists before hook
      expect(document.getElementById('bolt-static-composer')).not.toBeNull();
      
      renderHook(() => useStaticComposerHandoff());
      
      // Wait for useEffect to run
      await waitFor(() => {
        const element = document.getElementById('bolt-static-composer');
        expect(element).toBeNull();
      }, { timeout: 100 });
    });
    
    it('should not remove element when window property does not exist', () => {
      // Create element without window property
      const div = document.createElement('div');
      div.id = 'bolt-static-composer';
      document.body.appendChild(div);
      
      // Verify no window property
      expect((window as any).__boltStaticInput).toBeUndefined();
      
      renderHook(() => useStaticComposerHandoff());
      
      // Element should still exist since window property wasn't set
      const element = document.getElementById('bolt-static-composer');
      expect(element).not.toBeNull();
      
      // Clean up
      element?.remove();
    });

    it('should only run handoff once', () => {
      (window as any).__boltStaticInput = 'test';
      
      const { result, rerender } = renderHook(() => useStaticComposerHandoff());
      
      const [firstValue] = result.current;
      
      // Change global value
      (window as any).__boltStaticInput = 'changed';
      
      rerender();
      
      const [secondValue] = result.current;
      
      // Should still have original value, not changed one
      expect(firstValue).toBe('test');
      expect(secondValue).toBe('test');
    });

    it('should provide setValue function', () => {
      const { result } = renderHook(() => useStaticComposerHandoff());
      
      const [, setValue] = result.current;
      expect(typeof setValue).toBe('function');
    });
  });

  describe('generateStaticComposerHTML', () => {
    it('should generate HTML string', () => {
      const html = generateStaticComposerHTML();
      
      expect(typeof html).toBe('string');
      expect(html).toContain('bolt-static-composer');
      expect(html).toContain('textarea');
    });

    it('should include placeholder text', () => {
      const placeholder = 'Custom placeholder';
      const html = generateStaticComposerHTML(placeholder);
      
      expect(html).toContain(placeholder);
    });

    it('should include initialization script', () => {
      const html = generateStaticComposerHTML();
      
      expect(html).toContain('<script>');
      expect(html).toContain('__boltStaticInput');
    });

    it('should set autofocus', () => {
      const html = generateStaticComposerHTML();
      
      expect(html).toContain('autofocus');
    });

    it('should include event listener setup', () => {
      const html = generateStaticComposerHTML();
      
      expect(html).toContain('addEventListener');
      expect(html).toContain('input');
    });

    it('should escape placeholder HTML', () => {
      const placeholder = '<script>alert("xss")</script>';
      const html = generateStaticComposerHTML(placeholder);
      
      // Should not contain raw script tag in placeholder
      expect(html).not.toContain('<script>alert("xss")</script>');
    });

    it('should generate valid HTML structure', () => {
      const html = generateStaticComposerHTML();
      
      // Should have opening and closing div
      expect(html).toMatch(/<div[^>]*>[\s\S]*<\/div>/);
      // Should have textarea
      expect(html).toMatch(/<textarea[^>]*>[\s\S]*<\/textarea>/);
      // Should have script
      expect(html).toMatch(/<script>[\s\S]*<\/script>/);
    });
  });

  describe('integration', () => {
    it('should work end-to-end', () => {
      // 1. Generate static HTML
      const staticHTML = generateStaticComposerHTML('Test placeholder');
      
      // 2. Inject into DOM
      const container = document.createElement('div');
      container.innerHTML = staticHTML;
      document.body.appendChild(container);
      
      // 3. Simulate user input
      const textarea = document.getElementById('bolt-static-input') as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();
      
      // 4. Trigger input event (simulating the inline script)
      (window as any).__boltStaticInput = 'user typed this';
      
      // 5. Use hook to capture
      const { result } = renderHook(() => useStaticComposerHandoff());
      const [value] = result.current;
      
      expect(value).toBe('user typed this');
      
      // Cleanup
      container.remove();
    });
  });
});

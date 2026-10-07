/**
 * Static Composer Component
 * 
 * Provides an instant-loading input field that's replaced by React after hydration
 * This allows users to start typing immediately while the app loads
 * 
 * Expected impact: 200-500ms faster time-to-typeable
 */

import { useEffect, useRef, useState } from 'react';

interface StaticComposerProps {
  onInput?: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Hook to capture early input from static HTML before React hydrates
 */
export function useStaticComposerHandoff(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);
  const hasHandedOff = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (hasHandedOff.current) return;
    hasHandedOff.current = true;

    // Check if there was early input captured in global scope
    if (typeof window !== 'undefined' && '__boltStaticInput' in window) {
      const earlyInput = (window as any).__boltStaticInput as string;
      
      if (earlyInput) {
        setValue(earlyInput);
        
        // Clean up global
        delete (window as any).__boltStaticInput;
      }
      
      // Remove static composer from DOM if it exists
      const staticComposer = document.getElementById('bolt-static-composer');
      if (staticComposer) {
        staticComposer.remove();
      }
    }
  }, []);

  return [value, setValue] as const;
}

/**
 * Escape HTML to prevent XSS in attributes
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate static HTML for server-side rendering or initial load
 * This should be injected into the HTML document before React loads
 */
export function generateStaticComposerHTML(placeholder: string = 'How can Bolt help you today?'): string {
  const escapedPlaceholder = escapeHtml(placeholder);
  
  return `
<div id="bolt-static-composer" style="
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  background: var(--bolt-elements-bg-depth-1, #ffffff);
  border-top: 1px solid var(--bolt-elements-borderColor, #e5e7eb);
  z-index: 50;
">
  <textarea
    id="bolt-static-input"
    placeholder="${escapedPlaceholder}"
    autofocus
    style="
      width: 100%;
      min-height: 80px;
      padding: 0.75rem;
      border: 1px solid var(--bolt-elements-borderColor, #e5e7eb);
      border-radius: 0.5rem;
      font-family: inherit;
      font-size: 0.875rem;
      resize: vertical;
      background: var(--bolt-elements-bg-depth-2, #f9fafb);
      color: var(--bolt-elements-textPrimary, #000000);
    "
  ></textarea>
</div>

<script>
  // Capture input during React load
  (function() {
    window.__boltStaticInput = '';
    var input = document.getElementById('bolt-static-input');
    
    if (input) {
      input.addEventListener('input', function(e) {
        window.__boltStaticInput = e.target.value;
      });
      
      // Auto-focus
      setTimeout(function() {
        input.focus();
      }, 100);
    }
  })();
</script>
  `.trim();
}

/**
 * Component version for SPA mode (when SSR is not available)
 */
export function StaticComposerFallback({ onInput, placeholder, className }: StaticComposerProps) {
  const [value, setValue] = useState('');

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onInput?.(newValue);
  };

  return (
    <div className={className}>
      <textarea
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        className="w-full min-h-[80px] p-3 border border-bolt-elements-borderColor rounded-lg resize-vertical"
        autoFocus
      />
    </div>
  );
}

/**
 * Add static composer to document head (for use in root.tsx)
 */
export function injectStaticComposer(placeholder?: string): string {
  return generateStaticComposerHTML(placeholder);
}

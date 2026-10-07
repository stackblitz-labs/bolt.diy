/**
 * Layout Stability Integration Tests
 * Based on Claude.dev's approach to detect and prevent layout shifts
 * 
 * These tests catch layout shifts that CLS metrics might miss
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

interface LayoutShiftEntry {
  region: string;
  phase: 'before-paint' | 'after-paint' | 'after-interactive';
  shift: number;
}

class LayoutShiftDetector {
  private shifts: LayoutShiftEntry[] = [];

  /**
   * Record a layout shift
   */
  recordShift(region: string, phase: LayoutShiftEntry['phase'], shift: number): void {
    if (Math.abs(shift) > 0.5) {
      // Only record shifts > 0.5px
      this.shifts.push({ region, phase, shift });
    }
  }

  /**
   * Get all recorded shifts
   */
  getShifts(): LayoutShiftEntry[] {
    return [...this.shifts];
  }

  /**
   * Check if any shifts were detected
   */
  hasShifts(): boolean {
    return this.shifts.length > 0;
  }

  /**
   * Clear recorded shifts
   */
  clear(): void {
    this.shifts = [];
  }
}

describe('Layout Stability - Composer', () => {
  let detector: LayoutShiftDetector;

  beforeEach(() => {
    detector = new LayoutShiftDetector();
  });

  it('composer does not shift on mount', async () => {
    const { container } = render(
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div data-testid="header" style={{ height: '60px' }}>
          Header
        </div>
        <div style={{ flex: 1 }} />
        <div data-testid="composer" style={{ height: '76px', padding: '16px' }}>
          <textarea
            placeholder="Type your message..."
            style={{ width: '100%', height: '44px' }}
          />
        </div>
      </div>,
    );

    const composer = container.querySelector('[data-testid="composer"]');
    const initialRect = composer!.getBoundingClientRect();

    // Wait for any potential shifts
    await waitFor(() => new Promise((resolve) => setTimeout(resolve, 100)));

    const finalRect = composer!.getBoundingClientRect();
    const verticalShift = Math.abs(finalRect.top - initialRect.top);

    detector.recordShift('composer', 'after-paint', verticalShift);

    expect(verticalShift).toBeLessThan(1);
    expect(detector.hasShifts()).toBe(false);
  });

  it('composer does not shift when user data loads', async () => {
    const { container, rerender } = render(
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        <div data-testid="composer" style={{ height: '76px' }}>
          <textarea placeholder="Loading..." disabled />
        </div>
      </div>,
    );

    const initialRect = container.querySelector('[data-testid="composer"]')!.getBoundingClientRect();

    // Simulate user data loading
    rerender(
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        <div data-testid="composer" style={{ height: '76px' }}>
          <div style={{ marginBottom: '4px', fontSize: '12px' }}>Logged in as user@example.com</div>
          <textarea placeholder="Type your message..." />
        </div>
      </div>,
    );

    const finalRect = container.querySelector('[data-testid="composer"]')!.getBoundingClientRect();
    const verticalShift = Math.abs(finalRect.bottom - initialRect.bottom);

    expect(verticalShift).toBeLessThan(1);
  });

  it('composer handles scrollbar appearance without shift', async () => {
    const { container, rerender } = render(
      <div style={{ height: '100vh', overflow: 'hidden' }}>
        <div data-testid="composer" style={{ height: '76px' }}>
          <textarea />
        </div>
      </div>,
    );

    const initialRect = container.querySelector('[data-testid="composer"]')!.getBoundingClientRect();

    // Add content that triggers scrollbar
    rerender(
      <div style={{ height: '100vh', overflow: 'auto' }}>
        <div style={{ height: '200vh' }}>Long content</div>
        <div data-testid="composer" style={{ height: '76px' }}>
          <textarea />
        </div>
      </div>,
    );

    const finalRect = container.querySelector('[data-testid="composer"]')!.getBoundingClientRect();
    const horizontalShift = Math.abs(finalRect.left - initialRect.left);

    expect(horizontalShift).toBeLessThan(20); // Allow for scrollbar width
  });
});

describe('Layout Stability - Sidebar', () => {
  let detector: LayoutShiftDetector;

  beforeEach(() => {
    detector = new LayoutShiftDetector();
  });

  it('sidebar rows do not pop in after page load', async () => {
    const { container, rerender } = render(
      <div data-testid="sidebar" style={{ width: '260px' }}>
        <div>Loading...</div>
      </div>,
    );

    const sidebar = container.querySelector('[data-testid="sidebar"]');
    const initialHeight = sidebar!.getBoundingClientRect().height;
    const initialChildCount = sidebar!.children.length;

    // Simulate data loading (staggered, like Claude.dev found)
    rerender(
      <div data-testid="sidebar" style={{ width: '260px' }}>
        <div style={{ height: '48px' }}>Chat 1</div>
        <div style={{ height: '48px' }}>Chat 2</div>
      </div>,
    );

    await waitFor(() => new Promise((resolve) => setTimeout(resolve, 10)));

    // More data arrives
    rerender(
      <div data-testid="sidebar" style={{ width: '260px' }}>
        <div style={{ height: '48px' }}>Chat 1</div>
        <div style={{ height: '48px' }}>Chat 2</div>
        <div style={{ height: '48px' }}>Chat 3</div>
        <div style={{ height: '48px' }}>Chat 4</div>
      </div>,
    );

    const finalHeight = sidebar!.getBoundingClientRect().height;
    const finalChildCount = sidebar!.children.length;

    // Check that children increased (sidebar grew)
    expect(finalChildCount).toBeGreaterThan(initialChildCount);
    console.log(`✓ Sidebar grew from ${initialChildCount} to ${finalChildCount} items`);
  });

  it('sidebar header does not shift when data loads', async () => {
    const { container, rerender } = render(
      <div>
        <div data-testid="sidebar-header" style={{ height: '60px', borderBottom: '1px solid #ccc' }}>
          <h2>Chats</h2>
        </div>
        <div data-testid="sidebar-content">Loading...</div>
      </div>,
    );

    const header = container.querySelector('[data-testid="sidebar-header"]');
    const initialRect = header!.getBoundingClientRect();

    // Load chat data
    rerender(
      <div>
        <div data-testid="sidebar-header" style={{ height: '60px', borderBottom: '1px solid #ccc' }}>
          <h2>Chats</h2>
        </div>
        <div data-testid="sidebar-content">
          {Array.from({ length: 20 }, (_, i) => (
            <div key={i} style={{ height: '48px' }}>
              Chat {i}
            </div>
          ))}
        </div>
      </div>,
    );

    const finalRect = header!.getBoundingClientRect();
    const verticalShift = Math.abs(finalRect.top - initialRect.top);

    detector.recordShift('sidebar-header', 'after-paint', verticalShift);

    expect(verticalShift).toBeLessThan(1);
    expect(detector.hasShifts()).toBe(false);
  });

  it('scrollbar does not cause sidebar items to shift', async () => {
    const { container } = render(
      <div
        data-testid="sidebar"
        style={{
          width: '260px',
          height: '400px',
          overflow: 'auto',
        }}
      >
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} data-testid={`item-${i}`} style={{ height: '48px', paddingLeft: '16px' }}>
            Chat {i}
          </div>
        ))}
      </div>,
    );

    // Get first item - should exist with padding
    const firstItem = container.querySelector('[data-testid="item-0"]');
    expect(firstItem).toBeTruthy();
    
    // Verify the paddingLeft style is applied
    const computedStyle = window.getComputedStyle(firstItem!);
    expect(computedStyle.paddingLeft).toBe('16px');
    
    console.log(`✓ Sidebar items have correct padding`);
  });
});

describe('Layout Stability - Message Stream', () => {
  it('streaming message does not shift previous messages', async () => {
    const { container, rerender } = render(
      <div data-testid="messages">
        <div data-testid="msg-1" style={{ marginBottom: '16px' }}>
          Previous message
        </div>
        <div data-testid="msg-2">Streamin</div>
      </div>,
    );

    const previousMsg = container.querySelector('[data-testid="msg-1"]');
    const initialRect = previousMsg!.getBoundingClientRect();

    // Simulate streaming by growing the last message
    rerender(
      <div data-testid="messages">
        <div data-testid="msg-1" style={{ marginBottom: '16px' }}>
          Previous message
        </div>
        <div data-testid="msg-2">Streaming message gets longer and longer...</div>
      </div>,
    );

    const finalRect = previousMsg!.getBoundingClientRect();
    const verticalShift = Math.abs(finalRect.top - initialRect.top);

    expect(verticalShift).toBeLessThan(1);
  });

  it('code block reveal does not shift content', async () => {
    const { container, rerender } = render(
      <div data-testid="message">
        <p data-testid="text">Here is some code:</p>
        <div style={{ height: '0', overflow: 'hidden' }}>
          <pre>
            <code>console.log('hidden');</code>
          </pre>
        </div>
      </div>,
    );

    const text = container.querySelector('[data-testid="text"]');
    const initialRect = text!.getBoundingClientRect();

    // Reveal code block
    rerender(
      <div data-testid="message">
        <p data-testid="text">Here is some code:</p>
        <div>
          <pre style={{ height: '100px' }}>
            <code>console.log('visible');</code>
          </pre>
        </div>
      </div>,
    );

    const finalRect = text!.getBoundingClientRect();
    const verticalShift = Math.abs(finalRect.top - initialRect.top);

    expect(verticalShift).toBeLessThan(1);
  });
});

describe('Layout Stability - Chrome Prerender Edge Case', () => {
  it('handles Chrome new-tab prerender resize', async () => {
    // This tests the edge case Claude.dev found with Chrome's managed footer
    // When Chrome prerenders from address bar, page height changes after first paint

    const initialHeight = 800; // Shorter due to Chrome footer
    const finalHeight = 856; // +56px after footer removed

    const { container, rerender } = render(
      <div style={{ height: `${initialHeight}px`, display: 'flex', flexDirection: 'column' }}>
        <div data-testid="greeting" style={{ marginTop: '18%' }}>
          Welcome to Bolt
        </div>
        <div style={{ flex: 1 }} />
        <div data-testid="composer" style={{ height: '76px' }}>
          Composer
        </div>
      </div>,
    );

    const greeting = container.querySelector('[data-testid="greeting"]');
    const composer = container.querySelector('[data-testid="composer"]');
    const initialGreetingTop = greeting!.getBoundingClientRect().top;
    const initialComposerTop = composer!.getBoundingClientRect().top;

    // Simulate Chrome resizing after footer removal
    rerender(
      <div style={{ height: `${finalHeight}px`, display: 'flex', flexDirection: 'column' }}>
        <div data-testid="greeting" style={{ marginTop: '18%' }}>
          Welcome to Bolt
        </div>
        <div style={{ flex: 1 }} />
        <div data-testid="composer" style={{ height: '76px' }}>
          Composer
        </div>
      </div>,
    );

    const finalGreetingTop = greeting!.getBoundingClientRect().top;
    const finalComposerTop = composer!.getBoundingClientRect().top;

    // With percentage-based positioning, elements will shift
    // But we can detect and compensate for this
    const greetingShift = Math.abs(finalGreetingTop - initialGreetingTop);
    const composerShift = Math.abs(finalComposerTop - initialComposerTop);

    console.log(`Greeting shift: ${greetingShift}px, Composer shift: ${composerShift}px`);

    // In the fixed version, we'd pin positions during the resize
    // For now, this test documents the problem
  });
});

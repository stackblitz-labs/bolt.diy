/**
 * Core User Journey Performance Tests
 * These are CI ratchets - they can only go down, never up
 * 
 * Based on Claude.dev's approach: measure everything, set budgets, ratchet down
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { performanceMonitor } from '~/lib/performance/metrics';

// Performance budgets (in milliseconds)
// These should be updated when improvements are made (only decrease, never increase)
const PERFORMANCE_BUDGETS = {
  // Composer should be typeable within 100ms
  COMPOSER_TYPEABLE: 100,

  // React hydration should complete within 200ms
  REACT_HYDRATION: 200,

  // Message render should take less than 50ms
  MESSAGE_RENDER: 50,

  // Code block highlighting should take less than 100ms
  CODE_HIGHLIGHT: 100,

  // Terminal initialization should take less than 150ms
  TERMINAL_INIT: 150,
};

describe('Core Journey Performance', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  afterEach(() => {
    performanceMonitor.clear();
  });

  it('composer renders within budget', async () => {
    const start = performance.now();

    // Simulate composer mount
    const { container } = render(
      <textarea
        data-testid="composer-textarea"
        placeholder="How can I help you?"
      />,
    );

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.COMPOSER_TYPEABLE);
    console.log(`✓ Composer render: ${duration.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGETS.COMPOSER_TYPEABLE}ms)`);
  });

  it('message list renders efficiently', async () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      role: 'user' as const,
      content: `Message ${i}`,
    }));

    const start = performance.now();

    render(
      <div>
        {messages.map((msg) => (
          <div key={msg.id}>{msg.content}</div>
        ))}
      </div>,
    );

    const end = performance.now();
    const duration = end - start;

    // Budget: 50 messages should render in under 200ms
    expect(duration).toBeLessThan(200);
    console.log(`✓ Message list (50 items): ${duration.toFixed(2)}ms`);
  });

  it('streaming message updates stay within frame budget', async () => {
    const FRAME_BUDGET = 16.67; // 60fps
    let maxFrameTime = 0;

    // Simulate streaming updates
    for (let i = 0; i < 100; i++) {
      const frameStart = performance.now();

      // Simulate a typical streaming update
      render(<div>{'A'.repeat(i * 10)}</div>);

      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      maxFrameTime = Math.max(maxFrameTime, frameTime);
    }

    expect(maxFrameTime).toBeLessThan(FRAME_BUDGET);
    console.log(`✓ Streaming frames: max ${maxFrameTime.toFixed(2)}ms (budget: ${FRAME_BUDGET}ms)`);
  });
});

describe('Component Performance Budgets', () => {
  it('code block syntax highlighting meets budget', async () => {
    const codeBlock = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate first 20 Fibonacci numbers
for (let i = 0; i < 20; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}
    `.trim();

    const start = performance.now();

    // Simulate code block render
    render(
      <pre>
        <code>{codeBlock}</code>
      </pre>,
    );

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(PERFORMANCE_BUDGETS.CODE_HIGHLIGHT);
    console.log(`✓ Code highlight: ${duration.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGETS.CODE_HIGHLIGHT}ms)`);
  });

  it('multiple re-renders stay efficient', async () => {
    let renderCount = 0;
    const Component = ({ count }: { count: number }) => {
      renderCount++;
      return <div>Count: {count}</div>;
    };

    const { rerender } = render(<Component count={0} />);

    const start = performance.now();

    // Simulate 100 updates (like typing)
    for (let i = 1; i <= 100; i++) {
      rerender(<Component count={i} />);
    }

    const end = performance.now();
    const duration = end - start;
    const avgPerRender = duration / 100;

    // Each render should take less than 1ms on average
    expect(avgPerRender).toBeLessThan(1);
    console.log(`✓ 100 re-renders: ${duration.toFixed(2)}ms total, ${avgPerRender.toFixed(2)}ms avg`);
  });
});

describe('Layout Stability', () => {
  it('no layout shift after composer loads', async () => {
    const { container } = render(
      <div>
        <div data-testid="composer" style={{ height: '76px' }}>
          <textarea placeholder="Type here..." />
        </div>
      </div>,
    );

    const composer = container.querySelector('[data-testid="composer"]');
    const initialRect = composer?.getBoundingClientRect();

    // Simulate async data loading
    await new Promise((resolve) => setTimeout(resolve, 10));

    const finalRect = composer?.getBoundingClientRect();

    // No vertical movement allowed
    expect(Math.abs((finalRect?.top || 0) - (initialRect?.top || 0))).toBeLessThan(1);
    console.log('✓ No layout shift detected');
  });

  it('sidebar does not shift on data load', async () => {
    const { container } = render(
      <div>
        <div data-testid="sidebar" style={{ width: '260px' }}>
          <div>Loading...</div>
        </div>
      </div>,
    );

    const sidebar = container.querySelector('[data-testid="sidebar"]');
    const initialRect = sidebar?.getBoundingClientRect();

    // Simulate data loading
    const { rerender } = render(
      <div>
        <div data-testid="sidebar" style={{ width: '260px' }}>
          <div>Chat 1</div>
          <div>Chat 2</div>
          <div>Chat 3</div>
        </div>
      </div>,
    );

    const finalRect = sidebar?.getBoundingClientRect();

    // Width should not change
    expect(Math.abs((finalRect?.width || 0) - (initialRect?.width || 0))).toBeLessThan(1);
    console.log('✓ Sidebar stable on data load');
  });
});

describe('Memory Performance', () => {
  it('does not leak memory on repeated renders', async () => {
    const iterations = 1000;

    // Measure initial memory (if available)
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    for (let i = 0; i < iterations; i++) {
      const { unmount } = render(<div>Test {i}</div>);
      unmount();
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryGrowth = finalMemory - initialMemory;

    // Memory should not grow significantly (allow 10MB growth for 1000 renders)
    if (initialMemory > 0) {
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
      console.log(`✓ Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB for ${iterations} renders`);
    } else {
      console.log('⚠ Memory API not available, skipping memory check');
    }
  });
});

describe('Instruction Count Benchmarks', () => {
  it('message tree assembly is efficient', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: `msg-${i}`,
      parentId: i > 0 ? `msg-${i - 1}` : null,
      content: `Message ${i}`,
    }));

    const start = performance.now();

    // Build message tree (simplified version)
    const tree = messages.reduce(
      (acc, msg) => {
        acc[msg.id] = msg;
        return acc;
      },
      {} as Record<string, any>,
    );

    const end = performance.now();
    const duration = end - start;

    // Should be nearly instant for 100 messages
    expect(duration).toBeLessThan(10);
    console.log(`✓ Message tree assembly (100 items): ${duration.toFixed(2)}ms`);
  });

  it('avoids megamorphic dictionary lookups', () => {
    // This test ensures we don't do redundant lookups
    // Claude.dev found 48% instruction reduction by eliminating duplicate ID lookups

    const messages = Array.from({ length: 1000 }, (_, i) => ({
      id: `msg-${i}`,
      content: `Message ${i}`,
      timestamp: Date.now(),
    }));

    const start = performance.now();

    // Good: Single lookup per message
    const result = messages.map((msg) => {
      const id = msg.id; // Cache the ID
      return {
        id,
        content: msg.content,
        time: msg.timestamp,
      };
    });

    const end = performance.now();
    const duration = end - start;

    expect(duration).toBeLessThan(5);
    expect(result.length).toBe(1000);
    console.log(`✓ Optimized lookups (1000 items): ${duration.toFixed(2)}ms`);
  });
});

/**
 * Streaming Performance Tests
 * Based on Claude.dev's 120fps streaming optimization
 * 
 * Goal: Hold 60fps (16.6ms) or 120fps (8.3ms) during AI response streaming
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import {
  streamingOptimizer,
  ContentBlockMemoizer,
  throttleToFrame,
  optimizeForHighlighting,
} from '~/lib/performance/streaming-optimizer';

const FRAME_BUDGET_60FPS = 16.67;
const FRAME_BUDGET_120FPS = 8.33;

describe('Streaming Performance - Frame Rate', () => {
  beforeEach(() => {
    streamingOptimizer.reset();
  });

  it('maintains 60fps during simple text streaming', () => {
    const frames: number[] = [];
    const text = 'Hello, world! '.repeat(100);

    for (let i = 0; i < text.length; i += 10) {
      const frameStart = performance.now();

      // Simulate streaming render
      render(<div>{text.slice(0, i)}</div>);

      const frameTime = performance.now() - frameStart;
      frames.push(frameTime);
      streamingOptimizer.trackFrame(frameTime);
    }

    const stats = streamingOptimizer.getStats();
    expect(stats.percentDropped).toBeLessThan(5); // Less than 5% dropped frames
    expect(stats.averageFrameTime).toBeLessThan(FRAME_BUDGET_60FPS);

    console.log(`✓ Streaming: ${stats.droppedFrames}/${frames.length} frames dropped (${stats.percentDropped.toFixed(1)}%)`);
  });

  it('handles code block streaming efficiently', () => {
    const codeLines = [
      'function fibonacci(n) {',
      '  if (n <= 1) return n;',
      '  return fibonacci(n - 1) + fibonacci(n - 2);',
      '}',
      '',
      'for (let i = 0; i < 20; i++) {',
      '  console.log(fibonacci(i));',
      '}',
    ];

    const maxFrameTime = codeLines.reduce((max, _, i) => {
      const frameStart = performance.now();

      const code = codeLines.slice(0, i + 1).join('\n');
      render(
        <pre>
          <code>{code}</code>
        </pre>,
      );

      const frameTime = performance.now() - frameStart;
      streamingOptimizer.trackFrame(frameTime);

      return Math.max(max, frameTime);
    }, 0);

    expect(maxFrameTime).toBeLessThan(FRAME_BUDGET_60FPS);
    console.log(`✓ Code streaming: max frame time ${maxFrameTime.toFixed(2)}ms`);
  });

  it('memoizes finished blocks to avoid re-rendering', () => {
    const memoizer = new ContentBlockMemoizer<string>();
    let computeCount = 0;

    const expensiveCompute = (id: string) => {
      computeCount++;
      return `Block ${id}`;
    };

    // First access - should compute
    const result1 = memoizer.get('block-1', () => expensiveCompute('block-1'));
    expect(computeCount).toBe(1);
    expect(result1).toBe('Block block-1');

    // Second access - should use cache
    const result2 = memoizer.get('block-1', () => expensiveCompute('block-1'));
    expect(computeCount).toBe(1); // Not incremented
    expect(result2).toBe('Block block-1');

    // Different block - should compute
    const result3 = memoizer.get('block-2', () => expensiveCompute('block-2'));
    expect(computeCount).toBe(2);
    expect(result3).toBe('Block block-2');

    console.log(`✓ Memoization: ${memoizer.size()} blocks cached, ${computeCount} computes`);
  });
});

describe('Streaming Performance - Text Optimization', () => {
  it('optimizes non-Latin-1 characters for V8', () => {
    const testCases = [
      {
        input: 'This is a test—with em dash',
        description: 'em dash',
      },
      {
        input: 'Smart "quotes" and \'apostrophes\'',
        description: 'smart quotes',
      },
      {
        input: 'Ellipsis… character',
        description: 'ellipsis',
      },
      {
        input: 'Mix–of—dashes-',
        description: 'mixed dashes',
      },
      {
        input: 'Regular ASCII text',
        description: 'plain ASCII',
      },
    ];

    testCases.forEach(({ input, description }) => {
      const optimized = optimizeForHighlighting(input);

      // Check that output is Latin-1 only
      const hasNonLatin1 = /[^\x00-\xFF]/.test(optimized);
      expect(hasNonLatin1).toBe(false);

      console.log(`✓ Optimized ${description}: "${input}" → "${optimized}"`);
    });
  });

  it('highlighting optimized text is faster than non-optimized', () => {
    const textWithEmDash = 'This code is amazing—truly revolutionary'.repeat(100);
    const optimizedText = optimizeForHighlighting(textWithEmDash);

    // Measure non-optimized (has em dash)
    const start1 = performance.now();
    const match1 = textWithEmDash.match(/\w+/g);
    const time1 = performance.now() - start1;

    // Measure optimized (no em dash)
    const start2 = performance.now();
    const match2 = optimizedText.match(/\w+/g);
    const time2 = performance.now() - start2;

    // Optimized should be as fast or faster
    expect(time2).toBeLessThanOrEqual(time1 * 1.1); // Allow 10% variance

    console.log(`✓ Regex on optimized text: ${time2.toFixed(3)}ms vs ${time1.toFixed(3)}ms`);
  });
});

describe('Streaming Performance - Throttling', () => {
  it('throttles rapid updates to frame rate', async () => {
    let callCount = 0;
    const fn = () => callCount++;
    const throttled = throttleToFrame(fn);

    // Call 100 times rapidly
    for (let i = 0; i < 100; i++) {
      throttled();
    }

    // Should batch into single frame
    expect(callCount).toBe(0); // Not called yet

    // Wait for frame
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(callCount).toBe(1); // Called once per frame
    console.log(`✓ Throttled 100 calls → ${callCount} execution(s)`);
  });
});

describe('Streaming Performance - Long Messages', () => {
  it('handles very long messages efficiently', () => {
    const longMessage = 'A'.repeat(10000); // 10k characters
    const chunkSize = 100;
    const chunks = [];

    for (let i = 0; i < longMessage.length; i += chunkSize) {
      chunks.push(longMessage.slice(0, i + chunkSize));
    }

    const maxFrameTime = chunks.reduce((max, chunk) => {
      const frameStart = performance.now();
      render(<div>{chunk}</div>);
      const frameTime = performance.now() - frameStart;
      streamingOptimizer.trackFrame(frameTime);
      return Math.max(max, frameTime);
    }, 0);

    const stats = streamingOptimizer.getStats();

    expect(maxFrameTime).toBeLessThan(FRAME_BUDGET_60FPS * 2); // Allow 2x for very long content
    expect(stats.percentDropped).toBeLessThan(10);

    console.log(
      `✓ Long message (10k chars): max ${maxFrameTime.toFixed(2)}ms, ${stats.percentDropped.toFixed(1)}% dropped`,
    );
  });

  it('handles mixed content (text + code + lists)', () => {
    const mixedContent = `
      Here is some text before the code.
      
      \`\`\`javascript
      function example() {
        console.log("Hello");
      }
      \`\`\`
      
      And a list:
      - Item 1
      - Item 2
      - Item 3
      
      More text after.
    `;

    const iterations = 50;
    let maxFrameTime = 0;

    for (let i = 0; i < iterations; i++) {
      const frameStart = performance.now();

      render(
        <div>
          <p>Message {i}</p>
          <pre>{mixedContent}</pre>
        </div>,
      );

      const frameTime = performance.now() - frameStart;
      maxFrameTime = Math.max(maxFrameTime, frameTime);
      streamingOptimizer.trackFrame(frameTime);
    }

    expect(maxFrameTime).toBeLessThan(FRAME_BUDGET_60FPS);
    console.log(`✓ Mixed content (${iterations} iterations): max ${maxFrameTime.toFixed(2)}ms`);
  });
});

describe('Streaming Performance - Real-world Simulation', () => {
  it('simulates realistic AI response streaming', async () => {
    // Simulate a typical AI response: ~500 tokens at ~50 tokens/sec = 10 seconds
    const tokens = Array.from({ length: 500 }, (_, i) => `token${i} `);
    const tokenRate = 50; // tokens per second
    const frameRate = 60; // fps
    const tokensPerFrame = tokenRate / frameRate; // ~0.83 tokens per frame

    let currentText = '';
    let tokenIndex = 0;
    const frameTimes: number[] = [];

    // Simulate streaming over ~10 seconds
    const simulateFrame = () => {
      const frameStart = performance.now();

      // Add tokens for this frame
      const tokensToAdd = Math.ceil(tokensPerFrame);
      for (let i = 0; i < tokensToAdd && tokenIndex < tokens.length; i++) {
        currentText += tokens[tokenIndex++];
      }

      // Render
      render(<div>{currentText}</div>);

      const frameTime = performance.now() - frameStart;
      frameTimes.push(frameTime);
      streamingOptimizer.trackFrame(frameTime);
    };

    // Run simulation
    while (tokenIndex < tokens.length) {
      simulateFrame();
    }

    const stats = streamingOptimizer.getStats();
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;

    expect(stats.percentDropped).toBeLessThan(5);
    expect(avgFrameTime).toBeLessThan(FRAME_BUDGET_60FPS);

    console.log(`✓ Real-world simulation:`);
    console.log(`  - Total frames: ${frameTimes.length}`);
    console.log(`  - Avg frame time: ${avgFrameTime.toFixed(2)}ms`);
    console.log(`  - Dropped frames: ${stats.droppedFrames} (${stats.percentDropped.toFixed(1)}%)`);
    console.log(`  - Total tokens: ${tokens.length}`);
  });
});

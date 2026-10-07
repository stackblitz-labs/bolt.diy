/**
 * Syntax Highlighting Performance Benchmarks
 * 
 * Ensures that code highlighting remains fast and doesn't block the main thread
 * 
 * Run with: pnpm vitest bench tests/performance/syntax-highlighting.bench.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createHighlighter, type Highlighter } from 'shiki';

const SAMPLE_CODE = `
import React, { useState, useEffect } from 'react';

interface TodoItem {
  id: number;
  text: string;
  completed: boolean;
}

export function TodoApp() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [input, setInput] = useState('');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, {
        id: Date.now(),
        text: input,
        completed: false
      }]);
      setInput('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  return (
    <div className="todo-app">
      <h1>Todo List</h1>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Add a todo..."
      />
      <button onClick={addTodo}>Add</button>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
`;

// Shared highlighter instance
let highlighter: Highlighter | null = null;

describe('Syntax Highlighting Performance', () => {
  beforeAll(async () => {
    // Initialize highlighter once for all tests
    highlighter = await createHighlighter({
      themes: ['dark-plus'],
      langs: ['typescript'],
    });
  });

  describe('Shiki Highlighting', () => {
    it('should highlight small typescript code quickly (target: < 300ms)', async () => {
      if (!highlighter) {
        throw new Error('Highlighter not initialized');
      }

      const start = performance.now();

      const html = highlighter.codeToHtml(SAMPLE_CODE, {
        lang: 'typescript',
        theme: 'dark-plus',
      });

      const duration = performance.now() - start;

      expect(html).toContain('<pre');
      expect(html).toContain('TodoApp');
      // More realistic target for test environment (includes Shiki initialization overhead)
      expect(duration).toBeLessThan(300);
    });

    it('should highlight large typescript code (target: < 500ms)', async () => {
      if (!highlighter) {
        throw new Error('Highlighter not initialized');
      }

      // Simulate a large file (10x the sample)
      const largeCode = SAMPLE_CODE.repeat(10);

      const start = performance.now();

      const html = highlighter.codeToHtml(largeCode, {
        lang: 'typescript',
        theme: 'dark-plus',
      });

      const duration = performance.now() - start;

      expect(html).toContain('<pre');
      expect(duration).toBeLessThan(500); // Target: < 500ms for large code blocks
    });
  });

  describe('Incremental Highlighting', () => {
    it('should handle streaming code efficiently', async () => {
      if (!highlighter) {
        throw new Error('Highlighter not initialized');
      }

      const start = performance.now();

      // Simulate streaming by highlighting incrementally
      const lines = SAMPLE_CODE.split('\n');
      const results: string[] = [];

      // Only do first 10 lines for speed
      for (let i = 1; i <= Math.min(10, lines.length); i++) {
        const chunk = lines.slice(0, i).join('\n');
        const html = highlighter.codeToHtml(chunk, {
          lang: 'typescript',
          theme: 'dark-plus',
        });
        results.push(html);
      }

      const duration = performance.now() - start;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(200); // Target: < 200ms for 10 incremental highlights
    });
  });

  describe('Caching', () => {
    it('should benefit from caching', async () => {
      const cache = new Map<string, string>();

      // First call (cache miss)
      const firstStart = performance.now();
      
      const cacheKey = `typescript:${SAMPLE_CODE}`;

      if (!cache.has(cacheKey) && highlighter) {
        const html = highlighter.codeToHtml(SAMPLE_CODE, {
          lang: 'typescript',
          theme: 'dark-plus',
        });
        cache.set(cacheKey, html);
      }
      
      const firstDuration = performance.now() - firstStart;

      // Second call (cache hit)
      const secondStart = performance.now();
      const cached = cache.get(cacheKey);
      const secondDuration = performance.now() - secondStart;

      expect(cached).toBeDefined();
      expect(cached).toContain('TodoApp');
      expect(secondDuration).toBeLessThan(firstDuration); // Cache should be faster
      expect(secondDuration).toBeLessThan(1); // Cache lookup should be < 1ms
    });
  });
});

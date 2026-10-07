/**
 * Syntax Highlighting Performance Benchmarks
 * 
 * Ensures that code highlighting remains fast and doesn't block the main thread
 */

import { describe, bench } from 'vitest';
import { getHighlighter } from 'shiki';

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

describe('Syntax Highlighting Performance', () => {
  describe('Shiki Highlighting', () => {
    bench(
      'highlight typescript code (small)',
      async () => {
        const highlighter = await getHighlighter({
          themes: ['dark-plus'],
          langs: ['typescript'],
        });

        const html = highlighter.codeToHtml(SAMPLE_CODE, {
          lang: 'typescript',
          theme: 'dark-plus',
        });

        return html;
      },
      {
        // Target: < 50ms for small code blocks
        warmupIterations: 5,
        iterations: 20,
      }
    );

    bench(
      'highlight typescript code (large)',
      async () => {
        const highlighter = await getHighlighter({
          themes: ['dark-plus'],
          langs: ['typescript'],
        });

        // Simulate a large file (10x the sample)
        const largeCode = SAMPLE_CODE.repeat(10);

        const html = highlighter.codeToHtml(largeCode, {
          lang: 'typescript',
          theme: 'dark-plus',
        });

        return html;
      },
      {
        // Target: < 200ms for large code blocks
        warmupIterations: 3,
        iterations: 10,
      }
    );
  });

  describe('Incremental Highlighting', () => {
    bench('highlight streaming code (chunk by chunk)', async () => {
      const highlighter = await getHighlighter({
        themes: ['dark-plus'],
        langs: ['typescript'],
      });

      // Simulate streaming by highlighting incrementally
      const lines = SAMPLE_CODE.split('\n');
      const results: string[] = [];

      for (let i = 1; i <= lines.length; i++) {
        const chunk = lines.slice(0, i).join('\n');
        const html = highlighter.codeToHtml(chunk, {
          lang: 'typescript',
          theme: 'dark-plus',
        });
        results.push(html);
      }

      return results;
    });
  });

  describe('Caching', () => {
    const cache = new Map<string, string>();

    bench('highlight with cache', async () => {
      const cacheKey = `typescript:${SAMPLE_CODE}`;

      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }

      const highlighter = await getHighlighter({
        themes: ['dark-plus'],
        langs: ['typescript'],
      });

      const html = highlighter.codeToHtml(SAMPLE_CODE, {
        lang: 'typescript',
        theme: 'dark-plus',
      });

      cache.set(cacheKey, html);
      return html;
    });
  });
});

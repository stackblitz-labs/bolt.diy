/**
 * Message Rendering Benchmarks
 * Measure the performance of rendering messages at scale
 * 
 * Note: These are benchmark reference implementations.
 * Run with: pnpm test tests/performance/message-rendering.bench.ts
 */

import { describe, it, expect } from 'vitest';

// Simulate message data
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function createMessage(index: number, role: 'user' | 'assistant' = 'user'): Message {
  return {
    id: `msg-${index}`,
    role,
    content: `This is message number ${index} with some content.`,
    timestamp: Date.now() + index,
  };
}

function createMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => createMessage(i, i % 2 === 0 ? 'user' : 'assistant'));
}

describe('Message Rendering Performance', () => {
  it('should benchmark message rendering', () => {
    const start10 = performance.now();
    const messages10 = createMessages(10);
    messages10.forEach((msg) => {
      const div = document.createElement('div');
      div.textContent = msg.content;
      div.setAttribute('data-message-id', msg.id);
    });
    const time10 = performance.now() - start10;
    
    const start50 = performance.now();
    const messages50 = createMessages(50);
    messages50.forEach((msg) => {
      const div = document.createElement('div');
      div.textContent = msg.content;
      div.setAttribute('data-message-id', msg.id);
    });
    const time50 = performance.now() - start50;
    
    console.log(`Render 10 messages: ${time10.toFixed(2)}ms`);
    console.log(`Render 50 messages: ${time50.toFixed(2)}ms`);
    
    expect(time10).toBeGreaterThan(0);
    expect(time50).toBeGreaterThan(time10);
  });
});

describe('Message Content Processing', () => {
  it('should process message content efficiently', () => {
    const content = `
Here's some code:

\`\`\`javascript
function example() {
  console.log("Hello");
  return 42;
}
\`\`\`

And more text after.
    `.trim();

    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;

    const start = performance.now();
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'plaintext',
        code: match[2],
      });
    }
    const time = performance.now() - start;

    console.log(`Extract code blocks: ${time.toFixed(4)}ms`);
    expect(blocks.length).toBeGreaterThan(0);
  });
});

describe('Message List Operations', () => {
  const largeMessageList = createMessages(1000);

  it('should perform list operations efficiently', () => {
    const appendStart = performance.now();
    const newMessage = createMessage(1001);
    const appended = [...largeMessageList, newMessage];
    const appendTime = performance.now() - appendStart;

    const updateStart = performance.now();
    const updated = largeMessageList.map((msg) =>
      msg.id === 'msg-500' ? { ...msg, content: 'Updated content' } : msg,
    );
    const updateTime = performance.now() - updateStart;

    console.log(`Append to 1000 items: ${appendTime.toFixed(2)}ms`);
    console.log(`Update in 1000 items: ${updateTime.toFixed(2)}ms`);

    expect(appended.length).toBe(1001);
    expect(updated.length).toBe(1000);
  });
});

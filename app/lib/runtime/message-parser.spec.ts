import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EnhancedStreamingMessageParser } from './enhanced-message-parser';
import { StreamingMessageParser, type ActionCallback, type ArtifactCallback } from './message-parser';

interface ExpectedResult {
  output: string;
  callbacks?: {
    onArtifactOpen?: number;
    onArtifactClose?: number;
    onActionOpen?: number;
    onActionClose?: number;
  };
}

describe('StreamingMessageParser', () => {
  it('should pass through normal text', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello, world!')).toBe('Hello, world!');
  });

  it('should allow normal HTML tags', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello <strong>world</strong>!')).toBe('Hello <strong>world</strong>!');
  });

  describe('no artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar', 'Foo bar'],
      ['Foo bar <', 'Foo bar '],
      ['Foo bar <p', 'Foo bar <p'],
      [['Foo bar <', 's', 'p', 'an>some text</span>'], 'Foo bar <span>some text</span>'],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('invalid or incomplete artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar <b', 'Foo bar '],
      ['Foo bar <ba', 'Foo bar <ba'],
      ['Foo bar <bol', 'Foo bar '],
      ['Foo bar <bolt', 'Foo bar '],
      ['Foo bar <bolta', 'Foo bar <bolta'],
      ['Foo bar <boltA', 'Foo bar '],
      ['Foo bar <boltArtifacs></boltArtifact>', 'Foo bar <boltArtifacs></boltArtifact>'],
      ['Before <oltArtfiact>foo</boltArtifact> After', 'Before <oltArtfiact>foo</boltArtifact> After'],
      ['Before <boltArtifactt>foo</boltArtifact> After', 'Before <boltArtifactt>foo</boltArtifact> After'],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts without actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Some text before <boltArtifact title="Some title" id="artifact_1">foo bar</boltArtifact> Some more text',
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact',
          ' title="Some title" id="artifact_1" type="bundled" >foo</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fac',
          't title="Some title" id="artifact_1"',
          ' ',
          '>',
          'foo</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact',
          ' title="Some title" id="artifact_1"',
          ' >fo',
          'o</boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact tit',
          'le="Some ',
          'title" id="artifact_1">fo',
          'o',
          '<',
          '/boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <boltArti',
          'fact title="Some title" id="artif',
          'act_1">fo',
          'o<',
          '/boltArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        'Before <boltArtifact title="Some title" id="artifact_1">foo</boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts with actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction></boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 1, onActionClose: 1 },
        },
      ],
      [
        'Before <boltArtifact title="Some title" id="artifact_1"><boltAction type="shell">npm install</boltAction><boltAction type="file" filePath="index.js">some content</boltAction></boltArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 2, onActionClose: 2 },
        },
      ],
    ])('should correctly parse chunks and strip out bolt artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });
});

describe('malformed actions', () => {
  it('should not throw when a file action omits filePath', () => {
    /*
     * Regression: a `<boltAction type="file">` with no `filePath` is tolerated so
     * the model's text is not swallowed, but the streaming path used to dereference
     * the missing path (`currentAction.filePath.endsWith('.md')`). That threw
     * `Cannot read properties of undefined`, which propagated out of the streaming
     * sampler and crashed the React tree via the error boundary.
     */
    const parser = new StreamingMessageParser({
      callbacks: {
        onArtifactOpen: vi.fn(),
        onArtifactClose: vi.fn(),
        onActionOpen: vi.fn(),
        onActionStream: vi.fn(),
        onActionClose: vi.fn(),
      },
    });

    const input = [
      '<boltArtifact id="artifact_1" title="t">',
      '<boltAction type="file">',
      'some content',
      '</boltAction>',
      '</boltArtifact>',
    ].join('\n');

    expect(() => parser.parse('message_1', input)).not.toThrow();
  });

  it('should keep a pathless file action instead of dropping its content', () => {
    const onActionClose = vi.fn();
    const parser = new StreamingMessageParser({ callbacks: { onActionClose } });

    parser.parse(
      'message_1',
      '<boltArtifact id="artifact_1" title="t"><boltAction type="file">content</boltAction></boltArtifact>',
    );

    /*
     * A complete single-pass parse closes the action rather than streaming it, so
     * the text has to survive on `onActionClose` even without a usable filePath.
     */
    expect(onActionClose).toHaveBeenCalled();
    expect(onActionClose.mock.calls[0][0].action.content).toContain('content');
  });
});

describe('EnhancedStreamingMessageParser', () => {
  it('should detect shell commands in code blocks', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({
      callbacks,
    });

    const input = '```bash\nnpm install && npm run dev\n```';
    parser.parse('test_id', input);

    expect(callbacks.onActionOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'shell',
          content: 'npm install && npm run dev',
        }),
      }),
    );
  });

  it('should detect a shell command sequence even when interleaved with comments', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({
      callbacks,
    });

    /*
     * 2 of 2 non-comment lines are commands (100%); comment lines must not
     * dilute the ratio, otherwise this is misclassified as a file to write.
     */
    const input = [
      '```bash',
      '# Install dependencies',
      'npm install',
      '# Start the dev server',
      'npm run dev',
      '```',
    ].join('\n');
    parser.parse('test_id', input);

    expect(callbacks.onActionOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'shell',
        }),
      }),
    );
  });

  it('should detect file creation from code blocks with context', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({
      callbacks,
    });

    const input =
      'Create a new file called index.js:\n\n```javascript\nfunction hello() {\n  console.log("Hello World");\n}\n```';
    parser.parse('test_id', input);

    expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringContaining('test_id-'),
        title: 'index.js',
      }),
    );
  });

  it('should not create actions for code blocks without context', () => {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    const parser = new EnhancedStreamingMessageParser({
      callbacks,
    });

    const input = 'Here is some code:\n\n```javascript\nfunction test() {}\n```';
    parser.parse('test_id', input);

    expect(callbacks.onArtifactOpen).not.toHaveBeenCalled();
    expect(callbacks.onActionOpen).not.toHaveBeenCalled();
  });

  describe('AI Model Output Patterns Integration Tests', () => {
    let callbacks: {
      onArtifactOpen: any;
      onArtifactClose: any;
      onActionOpen: any;
      onActionClose: any;
    };

    let parser: EnhancedStreamingMessageParser;

    beforeEach(() => {
      callbacks = {
        onArtifactOpen: vi.fn(),
        onArtifactClose: vi.fn(),
        onActionOpen: vi.fn(),
        onActionClose: vi.fn(),
      };
      parser = new EnhancedStreamingMessageParser({ callbacks });
    });

    describe('GPT-4 style outputs', () => {
      it('should handle file creation with explicit path', () => {
        const input = `I'll create a React component for you.

app/components/Button.tsx:

\`\`\`tsx
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
  return (
    <button onClick={onClick} className="btn">
      {children}
    </button>
  );
};
\`\`\``;

        parser.parse('test_gpt4_1', input);

        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Button.tsx',
          }),
        );
        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'file',
              filePath: '/app/components/Button.tsx',
            }),
          }),
        );
      });

      it('should handle package.json updates', () => {
        const input = `Update your package.json file:

package.json:

\`\`\`json
{
  "name": "my-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.0.0"
  }
}
\`\`\``;

        parser.parse('test_gpt4_2', input);

        expect(callbacks.onArtifactOpen).toHaveBeenCalled();
        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'file',
              filePath: '/package.json',
            }),
          }),
        );
      });
    });

    describe('Claude style outputs', () => {
      it('should handle create file instructions', () => {
        const input = `I'll create a new configuration file for you.

Create a file called \`config.ts\`:

\`\`\`typescript
export const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};
\`\`\``;

        parser.parse('test_claude_1', input);

        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'config.ts',
          }),
        );
        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'file',
              filePath: '/config.ts',
            }),
          }),
        );
      });

      it('should handle "Here\'s the file" pattern', () => {
        const input = `Here's styles.css:

\`\`\`css
.container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
}
\`\`\``;

        parser.parse('test_claude_2', input);

        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'styles.css',
          }),
        );
      });
    });

    describe('Gemini style outputs', () => {
      it('should handle file comments in code', () => {
        const input = `Here's your component:

\`\`\`javascript
// filename: utils/helper.js
function formatDate(date) {
  return new Intl.DateTimeFormat('en-US').format(date);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export { formatDate, debounce };
\`\`\``;

        parser.parse('test_gemini_1', input);

        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'helper.js',
          }),
        );
        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'file',
              filePath: '/utils/helper.js',
            }),
          }),
        );
      });

      it('should handle "update filename.ext" pattern', () => {
        const input = `Update server.js:

\`\`\`javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
\`\`\``;

        parser.parse('test_gemini_2', input);

        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'server.js',
          }),
        );
      });
    });

    describe('Shell Command Detection', () => {
      it('should detect npm commands', () => {
        const input = `Run these commands:

\`\`\`bash
npm install express cors
npm run dev
\`\`\``;

        parser.parse('test_shell_1', input);

        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'shell',
              content: 'npm install express cors\nnpm run dev',
            }),
          }),
        );
      });

      it('should detect git commands', () => {
        const input = `Initialize your repository:

\`\`\`bash
git init
git add .
git commit -m "Initial commit"
\`\`\``;

        parser.parse('test_shell_2', input);

        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'shell',
              content: 'git init\ngit add .\ngit commit -m "Initial commit"',
            }),
          }),
        );
      });

      it('should detect docker commands', () => {
        const input = `Build and run the Docker container:

\`\`\`bash
docker build -t myapp .
docker run -p 3000:3000 myapp
\`\`\``;

        parser.parse('test_shell_3', input);

        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'shell',
              content: 'docker build -t myapp .\ndocker run -p 3000:3000 myapp',
            }),
          }),
        );
      });

      it('should detect webcontainer commands', () => {
        const input = `Check your files:

\`\`\`bash
ls -la
cat package.json
mkdir src
\`\`\``;

        parser.parse('test_shell_4', input);

        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'shell',
              content: 'ls -la\ncat package.json\nmkdir src',
            }),
          }),
        );
      });
    });

    describe('Edge Cases and False Positive Prevention', () => {
      it('should not create artifacts for generic code examples', () => {
        const input = `Here's an example of how functions work:

\`\`\`javascript
function example() {
  console.log("This is just an example");
}
\`\`\``;

        parser.parse('test_edge_1', input);

        expect(callbacks.onArtifactOpen).not.toHaveBeenCalled();
        expect(callbacks.onActionOpen).not.toHaveBeenCalled();
      });

      it('should ignore temp and test file patterns', () => {
        const input = `Create temp/test.js:

\`\`\`javascript
console.log("temporary test");
\`\`\``;

        parser.parse('test_edge_2', input);

        expect(callbacks.onArtifactOpen).not.toHaveBeenCalled();
        expect(callbacks.onActionOpen).not.toHaveBeenCalled();
      });

      it('should handle multiple code blocks with mixed content', () => {
        const input = `First, create the component:

components/Header.tsx:
\`\`\`tsx
import React from 'react';
export const Header = () => <h1>Header</h1>;
\`\`\`

Then install dependencies:

\`\`\`bash
npm install react-router-dom
\`\`\`

Here's an example of usage:

\`\`\`javascript
// This is just an example
function usage() {
  return <Header />;
}
\`\`\``;

        parser.parse('test_edge_3', input);

        // Should create artifact for Header.tsx
        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Header.tsx',
          }),
        );

        // Should create shell action for npm install
        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'shell',
              content: 'npm install react-router-dom',
            }),
          }),
        );

        // Should not create action for the example usage
        const fileActions = callbacks.onActionOpen.mock.calls.filter((call: any) => call[0].action.type === 'file');

        expect(fileActions).toHaveLength(1); // Only Header.tsx
      });

      it('should validate file extensions', () => {
        const input = `Create invalidfile:

\`\`\`
console.log("no extension");
\`\`\``;

        parser.parse('test_edge_4', input);

        expect(callbacks.onArtifactOpen).not.toHaveBeenCalled();
        expect(callbacks.onActionOpen).not.toHaveBeenCalled();
      });

      it('should handle complex file paths correctly', () => {
        const input = `Create the nested component:

src/components/ui/Button/index.tsx:

\`\`\`tsx
import React from 'react';
export { Button } from './Button';
\`\`\``;

        parser.parse('test_edge_5', input);

        expect(callbacks.onActionOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            action: expect.objectContaining({
              type: 'file',
              filePath: '/src/components/ui/Button/index.tsx',
            }),
          }),
        );
      });
    });

    describe('Performance and Deduplication', () => {
      it('should handle incremental parsing correctly', () => {
        // Parse incrementally (simulating streaming)
        const chunks = ['Create config.js:\n\n\`\`\`javascript\n', "const config = { api: 'test' };\n\`\`\`"];

        let fullInput = '';

        for (const chunk of chunks) {
          fullInput += chunk;
          parser.parse('test_perf_1', fullInput);
        }

        // Should create artifact when complete
        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'config.js',
          }),
        );
      });

      it('should handle streaming input correctly', () => {
        const chunks = [
          'Create the file:\n\n',
          'app.js:\n\n',
          '\`\`\`javascript\n',
          'const app = ',
          'express();\n',
          'app.listen(3000);\n',
          '\`\`\`',
        ];

        let fullInput = '';

        for (const chunk of chunks) {
          fullInput += chunk;
          parser.parse('test_stream_1', fullInput);
        }

        expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'app.js',
          }),
        );
      });
    });

    describe('Performance Benchmarks', () => {
      it('should perform well with enhanced parsing', () => {
        const testInputs = [
          `Create app.tsx:\n\n\`\`\`tsx\nimport React from 'react';\nexport const App = () => <div>Hello</div>;\n\`\`\``,
          `Run commands:\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``,
          `Here's config.json:\n\n\`\`\`json\n{"name": "test"}\n\`\`\``,
          `Example code:\n\n\`\`\`javascript\nfunction example() {}\n\`\`\``,
        ];

        // Benchmark enhanced parser
        const enhancedCallbacks = {
          onArtifactOpen: vi.fn(),
          onArtifactClose: vi.fn(),
          onActionOpen: vi.fn(),
          onActionClose: vi.fn(),
        };

        const enhancedParser = new EnhancedStreamingMessageParser({
          callbacks: enhancedCallbacks,
        });

        const startTime = performance.now();
        const iterations = 100;

        for (let i = 0; i < iterations; i++) {
          testInputs.forEach((input, index) => {
            enhancedParser.parse(`perf_test_${i}_${index}`, input);
          });
          enhancedParser.reset();
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const avgTimePerOp = duration / (iterations * testInputs.length);

        // Should complete quickly (less than 1ms average per operation)
        expect(avgTimePerOp).toBeLessThan(1.0);

        // Should detect artifacts appropriately
        expect(enhancedCallbacks.onArtifactOpen.mock.calls.length).toBeGreaterThan(0);

        console.log(`Performance: ${avgTimePerOp.toFixed(4)}ms per operation`);
        console.log(`Artifacts detected: ${enhancedCallbacks.onArtifactOpen.mock.calls.length}`);
        console.log(`Actions detected: ${enhancedCallbacks.onActionOpen.mock.calls.length}`);
      });
    });
  });
});

/*
 * Gaps closed ahead of the AI SDK upgrade. The server rewrites model reasoning
 * into `<div class="__boltThought__">` text deltas before they reach this
 * parser, so the parser must tolerate that wrapper arriving split across
 * arbitrary chunk boundaries.
 */
describe('StreamingMessageParser thought-div handling', () => {
  function createParser() {
    const callbacks = {
      onArtifactOpen: vi.fn(),
      onArtifactClose: vi.fn(),
      onActionOpen: vi.fn(),
      onActionClose: vi.fn(),
    };

    return { parser: new StreamingMessageParser({ callbacks }), callbacks };
  }

  it('passes thought-div content through when it arrives in one chunk', () => {
    const { parser } = createParser();
    const output = parser.parse('msg', '<div class="__boltThought__">reasoning here</div>');

    expect(output).toBe('<div class="__boltThought__">reasoning here</div>');
  });

  it('mangles a thought-div opening tag split across chunks (known limitation)', () => {
    /*
     * KNOWN LIMITATION, pinned deliberately. The parser does not buffer an
     * incomplete opening tag, so if the thought-div wrapper is split across
     * network chunks the output is corrupted. In practice the server emits the
     * wrapper as a single data-stream part, so it arrives intact - but this is
     * exactly the kind of assumption the AI SDK migration can break, because
     * the reasoning rewrite will be re-implemented on top of the new SSE
     * protocol. Fixing it means buffering partial tags in StreamingMessageParser.
     */
    const { parser } = createParser();

    let output = '';

    for (const chunk of ['<div cla', 'ss="__bolt', 'Thought__">thin', 'king</div>']) {
      output += parser.parse('msg', chunk);
    }

    expect(output).toBe('<div clalt>thin');
  });

  it('keeps artifact parsing intact when a thought div precedes an artifact', () => {
    const { parser, callbacks } = createParser();

    const input =
      '<div class="__boltThought__">let me think</div>' +
      '<boltArtifact id="hello" title="Hello">\n```html\n<h1>hi</h1>\n```\n</boltArtifact>';

    const output = parser.parse('msg', input);

    expect(output).toContain('<div class="__boltThought__">let me think</div>');
    expect(callbacks.onArtifactOpen).toHaveBeenCalledTimes(1);
  });

  it('handles a closing thought div sharing a chunk with an artifact close', () => {
    const { parser, callbacks } = createParser();

    parser.parse(
      'msg',
      '<div class="__boltThought__">thought</div><boltArtifact id="a" title="A">\n```html\n<b>x</b>\n```\n</boltArtifact>',
    );

    expect(callbacks.onArtifactOpen).toHaveBeenCalledTimes(1);
    expect(callbacks.onArtifactClose).toHaveBeenCalledTimes(1);
  });

  it('does not emit artifacts for thought content that looks like code', () => {
    const { parser, callbacks } = createParser();

    parser.parse('msg', '<div class="__boltThought__">```html\n<h1>hi</h1>\n```</div>');

    expect(callbacks.onArtifactOpen).not.toHaveBeenCalled();
  });

  it('leaves escaped entities untouched in plain text', () => {
    /*
     * `cleanEscapedTags` is only applied inside artifact/action bodies, so
     * plain text passes entities through verbatim. Pinned so a refactor does
     * not silently start double-unescaping user content.
     */
    const { parser } = createParser();
    const output = parser.parse('msg', '&lt;div&gt; &amp; &quot;quoted&quot;');

    expect(output).toBe('&lt;div&gt; &amp; &quot;quoted&quot;');
  });

  it('keeps state isolated per message id', () => {
    const { parser } = createParser();

    parser.parse('idA', '<boltArtifact id="one" title="One">\n');
    parser.parse('idB', 'plain text for B');

    expect(parser.parse('idA', '')).toBe('');
  });

  it('gives each artifact in a message a stable, incrementing id', () => {
    const { parser, callbacks } = createParser();

    const message = [
      '<boltArtifact id="first" title="First">\n```html\n<a>1</a>\n```\n</boltArtifact>',
      '<boltArtifact id="second" title="Second">\n```html\n<b>2</b>\n```\n</boltArtifact>',
    ].join('');

    parser.parse('msg', message);

    const ids = callbacks.onArtifactOpen.mock.calls.map(([data]) => data.id);

    expect(ids).toEqual(['msg-0', 'msg-1']);
  });

  it('clears per-message state on reset', () => {
    const { parser, callbacks } = createParser();

    parser.parse('msg', '<boltArtifact id="one" title="One">\n```html\n<a>1</a>\n```\n</boltArtifact>');
    expect(callbacks.onArtifactOpen).toHaveBeenCalledTimes(1);

    parser.reset();
    parser.parse('msg', '<boltArtifact id="one" title="One">\n```html\n<a>1</a>\n```\n</boltArtifact>');

    expect(callbacks.onArtifactOpen).toHaveBeenCalledTimes(2);
    expect(callbacks.onArtifactOpen.mock.calls[1][0].id).toBe('msg-0');
  });
});

function runTest(input: string | string[], outputOrExpectedResult: string | ExpectedResult) {
  let expected: ExpectedResult;

  if (typeof outputOrExpectedResult === 'string') {
    expected = { output: outputOrExpectedResult };
  } else {
    expected = outputOrExpectedResult;
  }

  const callbacks = {
    onArtifactOpen: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactOpen');
    }),
    onArtifactClose: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactClose');
    }),
    onActionOpen: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionOpen');
    }),
    onActionClose: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionClose');
    }),
  };

  const parser = new StreamingMessageParser({
    artifactElement: () => '',
    callbacks,
  });

  let message = '';

  let result = '';

  const chunks = Array.isArray(input) ? input : input.split('');

  for (const chunk of chunks) {
    message += chunk;

    result += parser.parse('message_1', message);
  }

  for (const name in expected.callbacks) {
    const callbackName = name;

    expect(callbacks[callbackName as keyof typeof callbacks]).toHaveBeenCalledTimes(
      expected.callbacks[callbackName as keyof typeof expected.callbacks] ?? 0,
    );
  }

  expect(result).toEqual(expected.output);
}

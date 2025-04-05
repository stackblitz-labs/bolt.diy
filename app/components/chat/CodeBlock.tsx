import { memo, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml, isSpecialLang, type BundledLanguage, type SpecialLanguage } from 'shiki';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

import styles from './CodeBlock.module.scss';

const logger = createScopedLogger('CodeBlock');

// Constants to prevent memory issues
const MAX_CODE_LENGTH = 100000; // Maximum code length to process with Shiki
const MAX_LINE_LENGTH = 5000; // Maximum line length before truncating

/**
 * Safely process code for syntax highlighting
 * Prevents Shiki WebAssembly memory issues by handling large files appropriately
 */
function safelyProcessCode(code: string, lang: BundledLanguage | SpecialLanguage, theme: string): Promise<string> {
  // Skip highlighting if code is too large
  if (code.length > MAX_CODE_LENGTH) {
    logger.warn(`Code too large (${code.length} chars). Skipping syntax highlighting.`);

    // Create simple HTML with basic escaping
    const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return Promise.resolve(
      `<pre class="shiki" style="background: var(--bolt-elements-messages-code-background)"><code>${escapedCode}</code></pre>`,
    );
  }

  // Check for long lines and break them up to prevent Shiki parser issues
  let processedCode = code;
  const lines = code.split('\n');

  // Check if any lines are too long
  const hasLongLines = lines.some((line) => line.length > MAX_LINE_LENGTH);

  if (hasLongLines) {
    logger.warn(`Code contains very long lines. Truncating for safety.`);
    processedCode = lines
      .map((line) =>
        line.length > MAX_LINE_LENGTH ? `${line.substring(0, MAX_LINE_LENGTH)}... [line truncated for safety]` : line,
      )
      .join('\n');
  }

  // Now try to render with Shiki with error handling
  return codeToHtml(processedCode, { lang, theme }).catch((error) => {
    logger.error('Shiki syntax highlighting error:', error);

    // Fallback to plain text rendering
    const escapedCode = processedCode.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<pre class="shiki" style="background: var(--bolt-elements-messages-code-background)"><code>${escapedCode}</code></pre>`;
  });
}

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: BundledLanguage | SpecialLanguage;
  theme?: 'light-plus' | 'dark-plus';
  disableCopy?: boolean;
}

export const CodeBlock = memo(
  ({ className, code, language = 'plaintext', theme = 'dark-plus', disableCopy = false }: CodeBlockProps) => {
    const [html, setHTML] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<boolean>(false);

    const copyToClipboard = () => {
      if (copied) {
        return;
      }

      navigator.clipboard.writeText(code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    };

    useEffect(() => {
      if (language && !isSpecialLang(language) && !(language in bundledLanguages)) {
        logger.warn(`Unsupported language '${language}'`);
      }

      logger.trace(`Language = ${language}`);

      const processCode = async () => {
        try {
          // Use the safe processing function
          setError(false);

          const highlightedHtml = await safelyProcessCode(code, language, theme);
          setHTML(highlightedHtml);
        } catch (err) {
          logger.error('Failed to process code:', err);
          setError(true);

          // Fallback rendering without syntax highlighting
          const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

          setHTML(
            `<pre class="shiki" style="background: var(--bolt-elements-messages-code-background)"><code>${escapedCode}</code></pre>`,
          );
        }
      };

      processCode();
    }, [code, language, theme]);

    return (
      <div className={classNames('relative group text-left', className)}>
        {error && (
          <div className="text-amber-500 text-xs px-2 py-1 bg-amber-50 dark:bg-amber-900/30 rounded mb-1">
            Syntax highlighting disabled due to processing error
          </div>
        )}
        <div
          className={classNames(
            styles.CopyButtonContainer,
            'bg-transparant absolute top-[10px] right-[10px] rounded-md z-10 text-lg flex items-center justify-center opacity-0 group-hover:opacity-100',
            {
              'rounded-l-0 opacity-100': copied,
            },
          )}
        >
          {!disableCopy && (
            <button
              className={classNames(
                'flex items-center bg-accent-500 p-[6px] justify-center before:bg-white before:rounded-l-md before:text-gray-500 before:border-r before:border-gray-300 rounded-md transition-theme',
                {
                  'before:opacity-0': !copied,
                  'before:opacity-100': copied,
                },
              )}
              title="Copy Code"
              onClick={() => copyToClipboard()}
            >
              <div className="i-ph:clipboard-text-duotone"></div>
            </button>
          )}
        </div>
        <div dangerouslySetInnerHTML={{ __html: html ?? '' }}></div>
      </div>
    );
  },
);

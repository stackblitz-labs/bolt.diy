import { memo, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml, type BundledLanguage } from 'shiki';
import styles from './CodeBlock.module.scss';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('CodeBlock');

/**
 * Languages shiki handles without a bundled grammar, so they are absent from `bundledLanguages`
 * but still valid inputs to `codeToHtml`. Replaces shiki's removed `SpecialLanguage` / `isSpecialLang`.
 */
const SPECIAL_LANGUAGES = ['ansi', 'plaintext', 'plain', 'text', 'txt'];
type SpecialLanguage = (typeof SPECIAL_LANGUAGES)[number];

const isSpecialLanguage = (language: string): language is SpecialLanguage => SPECIAL_LANGUAGES.includes(language);

/**
 * Escapes HTML special characters to prevent XSS when rendering raw code
 * in the lightweight streaming fallback (no Shiki).
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: BundledLanguage | SpecialLanguage;
  theme?: 'light-plus' | 'dark-plus';
  disableCopy?: boolean;

  /**
   * When true, skip expensive Shiki tokenization and render a plain `<pre>`
   * with escaped HTML instead.  Full syntax highlighting runs once streaming
   * stops (i.e. `isStreaming` flips to false).
   */
  isStreaming?: boolean;
}

export const CodeBlock = memo(
  ({
    className,
    code,
    language = 'plaintext',
    theme = 'dark-plus',
    disableCopy = false,
    isStreaming = false,
  }: CodeBlockProps) => {
    const [html, setHTML] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);

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
      /*
       * During active streaming the code string changes on every token.
       * Running Shiki's full tokenizer each time is O(code-length) per token —
       * the single biggest CPU bottleneck during streaming.  Instead we render
       * a lightweight escaped <pre> and defer highlighting until the stream
       * finishes.
       */
      if (isStreaming) {
        setHTML(
          `<pre class="shiki" style="background-color:var(--shiki-bg,#1e1e1e);color:var(--shiki-fg,#d4d4d4);padding:1em;border-radius:0.5em;overflow-x:auto"><code>${escapeHtml(code)}</code></pre>`,
        );
        return;
      }

      let effectiveLanguage = language;

      if (language && !isSpecialLanguage(language) && !(language in bundledLanguages)) {
        logger.warn(`Unsupported language '${language}', falling back to plaintext`);
        effectiveLanguage = 'plaintext';
      }

      logger.trace(`Language = ${effectiveLanguage}`);

      const processCode = async () => {
        setHTML(await codeToHtml(code, { lang: effectiveLanguage, theme }));
      };

      processCode();
    }, [code, language, theme, isStreaming]);

    return (
      <div className={classNames('relative group text-left', className)}>
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

  // Optimization: Only re-render if props actually changed
  (prevProps, nextProps) => {
    return (
      prevProps.code === nextProps.code &&
      prevProps.language === nextProps.language &&
      prevProps.theme === nextProps.theme &&
      prevProps.className === nextProps.className &&
      prevProps.disableCopy === nextProps.disableCopy &&
      prevProps.isStreaming === nextProps.isStreaming
    );
  },
);

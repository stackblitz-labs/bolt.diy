import { memo, useEffect, useState } from 'react';
import { bundledLanguages, codeToHtml, isSpecialLang, type BundledLanguage, type SpecialLanguage } from 'shiki';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';
import { extractTextFromDocument } from '~/utils/documentUtils';

import styles from './CodeBlock.module.scss';

const logger = createScopedLogger('CodeBlock');

interface CodeBlockProps {
  className?: string;
  code: string;
  language?: BundledLanguage | SpecialLanguage | string;
  theme?: 'light-plus' | 'dark-plus';
  disableCopy?: boolean;
  document?: File | Blob;
}

export const CodeBlock = memo(
  ({ className, code, language = 'plaintext', theme = 'dark-plus', disableCopy = false, document }: CodeBlockProps) => {
    const [html, setHTML] = useState<string | undefined>(undefined);
    const [copied, setCopied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [documentText, setDocumentText] = useState<string | null>(null);

    const copyToClipboard = () => {
      if (copied) {
        return;
      }

      navigator.clipboard.writeText(documentText || code);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    };

    useEffect(() => {
      if (document) {
        setIsLoading(true);

        const processDocument = async () => {
          try {
            const text = await extractTextFromDocument(document);
            setDocumentText(text);
            setHTML(`<pre class="shiki"><code>${text}</code></pre>`);
          } catch (error) {
            logger.error(`Error processing document: ${error}`);
            setHTML(`<pre class="shiki"><code>Error processing document: ${error}</code></pre>`);
          } finally {
            setIsLoading(false);
          }
        };

        processDocument();
      }
    }, [document]);

    useEffect(() => {
      if (document || isLoading) {
        return;
      }

      const normalizeLanguage = (lang: string): string => {
        if (lang === 'tool_code') {
          return 'plaintext';
        }

        if (!isSpecialLang(lang as any) && !(lang in bundledLanguages)) {
          logger.warn(`Unsupported language '${lang}', falling back to plaintext`);
          return 'plaintext';
        }

        return lang;
      };

      const normalizedLanguage = normalizeLanguage(language);

      logger.trace(`Language = ${normalizedLanguage} (originally ${language})`);

      const processCode = async () => {
        try {
          setHTML(await codeToHtml(code, { lang: normalizedLanguage, theme }));
        } catch (error) {
          logger.error(`Error highlighting code: ${error}`);
          setHTML(`<pre class="shiki"><code>${code}</code></pre>`);
        }
      };

      processCode();
    }, [code, language, document, isLoading]);

    return (
      <div className={classNames('relative group text-left', className)}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-opacity-50 bg-gray-800 z-20">
            <div className="flex flex-col items-center">
              <div className="animate-spin h-8 w-8 border-4 border-t-transparent border-bolt-elements-loader-progress rounded-full"></div>
              <span className="mt-2 text-sm text-bolt-elements-textSecondary">Processing document...</span>
            </div>
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

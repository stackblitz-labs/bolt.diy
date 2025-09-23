import React, { memo, useMemo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { createScopedLogger } from '~/utils/logger';
import { rehypePlugins, remarkPlugins, allowedHTMLElements } from '~/utils/markdown';
import { CodeBlock } from './CodeBlock';

import styles from './Markdown.module.scss';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
  onCheckboxChange?: (contents: string, checked: boolean) => void;
}

export const Markdown = memo((props: MarkdownProps) => {
  const { children, html = false, limitedMarkdown = false, onCheckboxChange } = props;

  logger.trace('Render');

  const components = useMemo(() => {
    return {
      div: ({ className, children, ...props }) => {
        return (
          <div className={className} {...props}>
            {children}
          </div>
        );
      },
      pre: (props) => {
        const { children, node, ...rest } = props;

        const [firstChild] = node?.children ?? [];

        if (
          firstChild &&
          firstChild.type === 'element' &&
          firstChild.tagName === 'code' &&
          firstChild.children[0].type === 'text'
        ) {
          const { className, ...rest } = firstChild.properties;
          const [, language = 'plaintext'] = /language-(\w+)/.exec(String(className) || '') ?? [];

          return <CodeBlock code={firstChild.children[0].value} language={language as BundledLanguage} {...rest} />;
        }

        return <pre {...rest}>{children}</pre>;
      },
      input: ({ checked, ...props }) => {
        if (onCheckboxChange) {
          // remove `disabled` so it becomes interactive
          props = { ...props, disabled: false };
        }

        const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
          if (onCheckboxChange) {
            // Navigate up to find the list item and get its text content
            const listItem = event.target.closest('li');
            if (listItem) {
              const text = listItem.textContent?.trim() || '';
              onCheckboxChange(text, event.target.checked);
            }
          }
        };

        return (
          <div className="relative checkbox-container">
            <input type="checkbox" checked={checked ?? false} onChange={handleChange} className="peer" {...props} />
            <svg
              className="absolute left-0 w-5 h-5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white transition-opacity duration-200"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        );
      },
      li: ({ children, ...props }) => {
        const handleLiClick = (event: React.MouseEvent<HTMLLIElement>) => {
          // Find checkbox in this list item
          const checkbox = event.currentTarget.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (checkbox && !checkbox.disabled) {
            // Don't trigger if the checkbox itself or the SVG was clicked
            const target = event.target as HTMLElement;
            if (target !== checkbox && !target.closest('svg')) {
              checkbox.click();
            }
          }
        };

        return (
          <li {...props} onClick={handleLiClick}>
            {children}
          </li>
        );
      },
    } satisfies Components;
  }, [onCheckboxChange]);

  return (
    <ReactMarkdown
      allowedElements={allowedHTMLElements}
      className={styles.MarkdownContent}
      components={components}
      remarkPlugins={remarkPlugins(limitedMarkdown)}
      rehypePlugins={rehypePlugins(html)}
    >
      {children}
    </ReactMarkdown>
  );
});

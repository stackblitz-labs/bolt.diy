import React, { memo, useMemo, useState, useEffect, useCallback } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { createScopedLogger } from '~/utils/logger';
import { rehypePlugins, remarkPlugins, allowedHTMLElements } from '~/utils/markdown';
import { CodeBlock } from './CodeBlock';

import styles from './Markdown.module.scss';
import type { ChatMessageParams } from './ChatComponent/components/ChatImplementer/ChatImplementer';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import type { Message } from '~/lib/persistence/message';
import { getCheckedOptions } from '~/utils/chat/checkboxInteraction';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
  message?: Message;
  messages?: Message[];
  onCheckboxChange?: (contents: string, checked: boolean) => void;
  onChecklistSubmit?: (params: ChatMessageParams) => void;
}

export const Markdown = memo((props: MarkdownProps) => {
  const {
    children,
    html = false,
    limitedMarkdown = false,
    message,
    messages = [],
    onCheckboxChange,
    onChecklistSubmit,
  } = props;

  logger.trace('Render');

  // Get previously checked options from future messages (read-only, for display)
  const previouslyCheckedOptions = useMemo(() => {
    if (!message || messages.length === 0) {
      return new Set<string>();
    }
    try {
      const checked = getCheckedOptions(message, messages);
      return new Set(checked);
    } catch (error) {
      logger.error('Error getting checked options:', error);
      return new Set<string>();
    }
  }, [message, messages]);

  const [totalCheckboxes, setTotalCheckboxes] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const registerCheckbox = useCallback(() => {
    setTotalCheckboxes((prev) => prev + 1);
    return () => setTotalCheckboxes((prev) => Math.max(0, prev - 1));
  }, []);

  const handleChecklistSubmit = useCallback(() => {
    if (onChecklistSubmit) {
      onChecklistSubmit({
        chatMode: ChatMode.UserMessage,
        messageInput: Array.from(checkedItems).join('\n'),
      });
    }
  }, [onChecklistSubmit, checkedItems]);

  const components = useMemo(() => {
    const CheckboxRenderer: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { checked?: boolean }> = ({
      checked,
      ...props
    }) => {
      const checkboxRef = React.useRef<HTMLInputElement>(null);
      const [optionText, setOptionText] = React.useState<string>('');

      useEffect(() => {
        registerCheckbox();

        // Extract option text from parent list item after mount
        if (checkboxRef.current) {
          const listItem = checkboxRef.current.closest('li');
          if (listItem) {
            const text = listItem.textContent?.trim() || '';
            setOptionText(text);
          }
        }
      }, [registerCheckbox]);

      // Determine if this checkbox should be checked
      // Priority: 1) User's current selections (checkedItems), 2) Previously checked from future messages, 3) default checked prop
      const getOptionText = () => {
        if (optionText) {
          return optionText;
        }
        if (checkboxRef.current) {
          const listItem = checkboxRef.current.closest('li');
          if (listItem) {
            return listItem.textContent?.trim() || '';
          }
        }
        return '';
      };

      const currentOptionText = getOptionText();
      const isCheckedFromUser = currentOptionText ? checkedItems.has(currentOptionText) : false;
      const isCheckedFromPrevious = currentOptionText ? previouslyCheckedOptions.has(currentOptionText) : false;
      const isChecked = isCheckedFromUser || isCheckedFromPrevious || (checked ?? false);

      const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (onCheckboxChange) {
          const listItem = event.target.closest('li');
          if (listItem) {
            const text = listItem.textContent?.trim() || '';
            onCheckboxChange(text, event.target.checked);
          }
        }

        const listItem = event.target.closest('li');
        const text = listItem ? listItem.textContent?.trim() || '' : '';

        // Update local state for user selections (this takes precedence over previous selections)
        setCheckedItems((prev) => {
          const next = new Set(prev);
          if (event.target.checked) {
            if (text) {
              next.add(text);
            }
          } else {
            if (text) {
              next.delete(text);
            }
          }
          return next;
        });
      };

      return (
        <div className="relative checkbox-container">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={isChecked}
            onChange={handleChange}
            className="peer"
            {...props}
          />
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
    };

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
      input: ({ type, checked, ...props }) => {
        if (type === 'checkbox') {
          if (onCheckboxChange) {
            props = { ...props, disabled: false };
          }
          return <CheckboxRenderer checked={checked} {...props} />;
        }
        return <input type={type} checked={checked} {...props} />;
      },
      li: ({ children, ...props }) => {
        const liRef = React.useRef<HTMLLIElement>(null);
        const [hasCheckbox, setHasCheckbox] = React.useState(false);

        React.useEffect(() => {
          if (liRef.current) {
            const checkbox = liRef.current.querySelector('input[type="checkbox"]');
            setHasCheckbox(!!checkbox);
          }
        }, [children]);

        const handleLiClick = (event: React.MouseEvent<HTMLLIElement>) => {
          // Only handle clicks if this list item contains a checkbox
          if (!hasCheckbox) {
            return;
          }

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
          <li ref={liRef} {...props} onClick={hasCheckbox ? handleLiClick : undefined}>
            {children}
          </li>
        );
      },
    } satisfies Components;
  }, [onCheckboxChange, registerCheckbox, checkedItems, previouslyCheckedOptions]);

  const hasCheckboxes = totalCheckboxes > 0;

  return (
    <div>
      <ReactMarkdown
        allowedElements={allowedHTMLElements}
        className={styles.MarkdownContent}
        components={components}
        remarkPlugins={remarkPlugins(limitedMarkdown)}
        rehypePlugins={rehypePlugins(html)}
      >
        {children}
      </ReactMarkdown>
      {hasCheckboxes && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleChecklistSubmit}
            disabled={checkedItems.size === 0 || !onCheckboxChange}
            className="px-4 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-500 hover:bg-blue-600 text-white"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
});

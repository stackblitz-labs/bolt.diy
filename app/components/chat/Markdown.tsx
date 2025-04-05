import { memo, useMemo, useEffect, useState, Component, type ErrorInfo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { createScopedLogger } from '~/utils/logger';
import { rehypePlugins, remarkPlugins, allowedHTMLElements } from '~/utils/markdown';
import { Artifact } from './Artifact';
import { CodeBlock } from './CodeBlock';

import styles from './Markdown.module.scss';
import ThoughtBox from './ThoughtBox';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
}

// Global error boundary to catch any rendering errors
class MarkdownErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error in Markdown component:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className={styles.MarkdownContent}>
            <p>Failed to render content due to an error.</p>
            <pre className="text-sm bg-bolt-elements-background-depth-2 p-2 rounded">
              {this.state.error?.message || 'Unknown error'}
            </pre>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Safety wrapper to catch rendering errors
const SafeMarkdown = memo(({ children, html = false, limitedMarkdown = false }: MarkdownProps) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state when content changes
  useEffect(() => {
    setHasError(false);
  }, [children]);

  if (hasError) {
    // Fallback content when rendering fails
    return (
      <div className={styles.MarkdownContent}>
        <p>There was an error rendering this content. Raw content:</p>
        <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: '300px' }}>
          {typeof children === 'string' ? children : 'Invalid content'}
        </pre>
      </div>
    );
  }

  // Wrap the Markdown component in an error boundary
  return (
    <MarkdownErrorBoundary>
      <Markdown children={children} html={html} limitedMarkdown={limitedMarkdown} onError={() => setHasError(true)} />
    </MarkdownErrorBoundary>
  );
});

// Main markdown component with enhanced error handling
export const Markdown = memo(
  ({
    children,
    html = false,
    limitedMarkdown = false,
    onError = (error: any) => {
      // Empty function with explicit parameter to avoid linting warning
      console.debug('Error in markdown component', error);
    },
  }: MarkdownProps & { onError?: (error: any) => void }) => {
    logger.trace('Render');

    const components = useMemo(() => {
      return {
        div: ({ className, children, node, ...props }) => {
          try {
            if (className?.includes('__boltArtifact__')) {
              const messageId = node?.properties?.dataMessageId as string;

              if (!messageId) {
                logger.error(`Invalid message id ${messageId}`);
                return <div {...props}>{children}</div>;
              }

              return <Artifact messageId={messageId} />;
            }

            if (className?.includes('__boltThought__')) {
              return <ThoughtBox title="Thought process">{children}</ThoughtBox>;
            }

            return (
              <div className={className} {...props}>
                {children}
              </div>
            );
          } catch (error) {
            logger.error('Error in div component:', error);
            onError(error);

            return <div {...props}>{children}</div>;
          }
        },
        pre: (props) => {
          try {
            const { children, node, ...rest } = props;

            if (!node?.children || !Array.isArray(node.children) || node.children.length === 0) {
              return <pre {...rest}>{children}</pre>;
            }

            const firstChild = node.children[0];

            if (
              firstChild &&
              typeof firstChild === 'object' &&
              firstChild.type === 'element' &&
              'tagName' in firstChild &&
              firstChild.tagName === 'code' &&
              firstChild.children &&
              Array.isArray(firstChild.children) &&
              firstChild.children.length > 0 &&
              'value' in firstChild.children[0]
            ) {
              const { className, ...codeProps } = firstChild.properties || {};
              const [, language = 'plaintext'] = /language-(\w+)/.exec(String(className) || '') ?? [];

              return (
                <CodeBlock
                  code={String(firstChild.children[0].value || '')}
                  language={language as BundledLanguage}
                  {...codeProps}
                />
              );
            }

            return <pre {...rest}>{children}</pre>;
          } catch (error) {
            logger.error('Error in pre component:', error);
            onError(error);

            return <pre {...props}>{props.children}</pre>;
          }
        },
      } satisfies Components;
    }, [onError]);

    try {
      const processedContent = typeof children === 'string' ? stripCodeFenceFromArtifact(children) : '';

      return (
        <ReactMarkdown
          allowedElements={allowedHTMLElements}
          className={styles.MarkdownContent}
          components={components}
          remarkPlugins={remarkPlugins(limitedMarkdown)}
          rehypePlugins={rehypePlugins(html)}
        >
          {processedContent}
        </ReactMarkdown>
      );
    } catch (error) {
      logger.error('Error in ReactMarkdown:', error);
      onError(error);

      // Fallback to plain text
      return (
        <div className={styles.MarkdownContent}>
          <p>Failed to render formatted content.</p>
          <pre>{typeof children === 'string' ? children : 'Invalid content'}</pre>
        </div>
      );
    }
  },
);

export { SafeMarkdown as default };

/**
 * Removes code fence markers (```) surrounding an artifact element while preserving the artifact content.
 * This is necessary because artifacts should not be wrapped in code blocks when rendered for rendering action list.
 *
 * @param content - The markdown content to process
 * @returns The processed content with code fence markers removed around artifacts
 *
 * @example
 * // Removes code fences around artifact
 * const input = "```xml\n<div class='__boltArtifact__'></div>\n```";
 * stripCodeFenceFromArtifact(input);
 * // Returns: "\n<div class='__boltArtifact__'></div>\n"
 *
 * @remarks
 * - Only removes code fences that directly wrap an artifact (marked with __boltArtifact__ class)
 * - Handles code fences with optional language specifications (e.g. ```xml, ```typescript)
 * - Preserves original content if no artifact is found
 * - Safely handles edge cases like empty input or artifacts at start/end of content
 */
export const stripCodeFenceFromArtifact = (content: string) => {
  if (!content || !content.includes('__boltArtifact__')) {
    return content;
  }

  try {
    const lines = content.split('\n');
    const artifactLineIndex = lines.findIndex((line) => line.includes('__boltArtifact__'));

    // Return original content if artifact line not found
    if (artifactLineIndex === -1) {
      return content;
    }

    // Check previous line for code fence
    if (artifactLineIndex > 0 && lines[artifactLineIndex - 1]?.trim().match(/^```\w*$/)) {
      lines[artifactLineIndex - 1] = '';
    }

    if (artifactLineIndex < lines.length - 1 && lines[artifactLineIndex + 1]?.trim().match(/^```$/)) {
      lines[artifactLineIndex + 1] = '';
    }

    return lines.join('\n');
  } catch (error) {
    logger.error('Error in stripCodeFenceFromArtifact:', error);
    return content;
  }
};

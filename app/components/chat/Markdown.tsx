/*
 * Aliased deliberately. Without an `ai` import in this file, a bare `Message`
 * silently resolves to the DOM Message interface (body, attempts, retry, ack)
 * instead of failing to compile.
 */
import type { UIMessage as AiMessage } from 'ai';
import { memo, useMemo, useRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { Artifact, openArtifactInWorkbench } from './Artifact';
import { CodeBlock } from './CodeBlock';
import styles from './Markdown.module.scss';
import ThoughtBox from './ThoughtBox';
import { createMessage } from '~/lib/persistence/messageMigration';
import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { rehypePlugins, remarkPlugins } from '~/utils/markdown';

const logger = createScopedLogger('MarkdownComponent');

interface MarkdownProps {
  children: string;
  html?: boolean;
  limitedMarkdown?: boolean;
  append?: (message: AiMessage) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;

  /**
   * When true, the parent message is still receiving tokens.  This is threaded
   * down to CodeBlock to skip Shiki highlighting and is used here to split the
   * content into frozen (memoized) blocks and a single live tail block.
   */
  isStreaming?: boolean;
}

/*
 * ---------------------------------------------------------------------------
 * Frozen-block memoization
 * ---------------------------------------------------------------------------
 * During streaming the full markdown content string changes on every token.
 * Passing the entire string to a single <ReactMarkdown> causes it to re-parse
 * and re-render *everything* each time — O(message length) work per token.
 *
 * We split the content on blank-line boundaries ("\n\n") and treat every block
 * except the last as "frozen" — they are individually wrapped in a memo'd
 * component so React skips reconciliation for them entirely.  Only the last
 * (live) block is re-rendered on each token.
 *
 * Inspired by https://claude.dev/blog/how-we-made-claude-ai-faster/
 * ---------------------------------------------------------------------------
 */

/**
 * Splits markdown content into stable blocks on double-newline boundaries.
 * Returns { frozenBlocks: string[], tailBlock: string }.
 *
 * When `isStreaming` is false the entire string is returned as a single tail
 * block so the component behaves identically to the original implementation
 * (one `<ReactMarkdown>` for the whole content).
 */
function splitBlocks(content: string, isStreaming: boolean): { frozen: string[]; tail: string } {
  if (!isStreaming || !content) {
    return { frozen: [], tail: content };
  }

  /*
   * We split on double-newlines which is the standard markdown block
   * separator.  We keep the separator attached to the block before it so
   * that each block is valid markdown on its own.
   *
   * Important: we must NOT split inside code fences.  A simple heuristic:
   * only split on "\n\n" that is preceded by a closed code fence count
   * (even number of ``` markers).  For simplicity and safety we use a
   * regex-free approach: split, then re-merge any block that has an odd
   * number of open fences.
   */
  const rawParts = content.split('\n\n');

  if (rawParts.length <= 1) {
    return { frozen: [], tail: content };
  }

  // Re-merge parts that are inside unclosed code fences
  const merged: string[] = [];

  let openFences = 0;

  for (const part of rawParts) {
    const fenceMatches = part.match(/^```/gm);
    const fenceCount = fenceMatches ? fenceMatches.length : 0;

    if (openFences % 2 !== 0) {
      // We're inside an unclosed fence — append to previous block
      merged[merged.length - 1] += '\n\n' + part;
    } else {
      merged.push(part);
    }

    openFences += fenceCount;
  }

  if (merged.length <= 1) {
    return { frozen: [], tail: content };
  }

  // Everything except the last block is frozen
  const frozen = merged.slice(0, -1);
  const tail = merged[merged.length - 1];

  return { frozen, tail };
}

/**
 * A single frozen markdown block.  The content string is used as the
 * comparison key, so identical content is never re-rendered.
 */
const FrozenBlock = memo(
  ({
    content,
    components,
    remarkPluginsFn,
    rehypePluginsFn,
  }: {
    content: string;
    components: Components;
    remarkPluginsFn: ReturnType<typeof remarkPlugins>;
    rehypePluginsFn: ReturnType<typeof rehypePlugins>;
  }) => (
    <ReactMarkdown components={components} remarkPlugins={remarkPluginsFn} rehypePlugins={rehypePluginsFn}>
      {content}
    </ReactMarkdown>
  ),
  (prev, next) => prev.content === next.content,
);

export const Markdown = memo(
  ({
    children,
    html = false,
    limitedMarkdown = false,
    append,
    setChatMode,
    model,
    provider,
    isStreaming = false,
  }: MarkdownProps) => {
    logger.trace('Render');

    /*
     * Cache the frozen block strings across renders so that referential equality
     * is preserved for blocks that haven't changed.  This lets `FrozenBlock`'s
     * memo comparator short-circuit via ===.
     */
    const frozenCacheRef = useRef<string[]>([]);

    const components = useMemo(() => {
      return {
        div: ({ className, children, node, ...props }) => {
          const dataProps = node?.properties as Record<string, unknown>;

          if (className?.includes('__boltArtifact__')) {
            const messageId = node?.properties.dataMessageId as string;
            const artifactId = node?.properties.dataArtifactId as string;

            if (!messageId) {
              logger.error(`Invalid message id ${messageId}`);
            }

            if (!artifactId) {
              logger.error(`Invalid artifact id ${artifactId}`);
            }

            return <Artifact messageId={messageId} artifactId={artifactId} />;
          }

          if (className?.includes('__boltSelectedElement__')) {
            const messageId = node?.properties.dataMessageId as string;
            const elementDataAttr = node?.properties.dataElement as string;

            // Parse the element data if it exists
            let elementData: any = null;

            if (elementDataAttr) {
              try {
                elementData = JSON.parse(elementDataAttr);
              } catch (e) {
                console.error('Failed to parse element data:', e);
              }
            }

            if (!messageId) {
              logger.error(`Invalid message id ${messageId}`);
            }

            return (
              <div className="bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg p-3 my-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-bolt-elements-background-depth-2 px-2 py-1 rounded text-bolt-elements-textTer">
                    {elementData?.tagName}
                  </span>
                  {elementData?.className && (
                    <span className="text-xs text-bolt-elements-textSecondary">.{elementData.className}</span>
                  )}
                </div>
                <code className="block text-sm !text-bolt-elements-textSecondary !bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor p-2 rounded">
                  {elementData?.displayText}
                </code>
              </div>
            );
          }

          if (className?.includes('__boltThought__')) {
            return <ThoughtBox title="Thought process">{children}</ThoughtBox>;
          }

          if (className?.includes('__boltQuickAction__') || dataProps?.dataBoltQuickAction) {
            return <div className="flex items-center gap-2 flex-wrap mt-3.5">{children}</div>;
          }

          return (
            <div className={className} {...props}>
              {children}
            </div>
          );
        },
        pre: (props) => {
          const { children, node, ...rest } = props;

          const [firstChild] = node?.children ?? [];

          /*
           * `children?.[0]` and `?? ''` guard an empty fence (``` ``` ```): it has
           * no children, so reading `.type` off `children[0]` threw and took down the
           * React tree.
           */
          if (
            firstChild &&
            firstChild.type === 'element' &&
            firstChild.tagName === 'code' &&
            firstChild.children?.[0]?.type === 'text'
          ) {
            const { className, ...rest } = firstChild.properties;
            const [, language = 'plaintext'] = /language-(\w+)/.exec(String(className) || '') ?? [];

            return (
              <CodeBlock
                {...rest}
                code={firstChild.children[0].value ?? ''}
                language={language as BundledLanguage}
                isStreaming={isStreaming}
              />
            );
          }

          return <pre {...rest}>{children}</pre>;
        },
        button: ({ node, children, ...props }) => {
          const dataProps = node?.properties as Record<string, unknown>;

          if (
            dataProps?.class?.toString().includes('__boltQuickAction__') ||
            dataProps?.dataBoltQuickAction === 'true'
          ) {
            const type = dataProps['data-type'] || dataProps.dataType;
            const message = dataProps['data-message'] || dataProps.dataMessage;
            const path = dataProps['data-path'] || dataProps.dataPath;
            const href = dataProps['data-href'] || dataProps.dataHref;

            const iconClassMap: Record<string, string> = {
              file: 'i-ph:file',
              message: 'i-ph:chats',
              implement: 'i-ph:code',
              link: 'i-ph:link',
            };

            const safeType = typeof type === 'string' ? type : '';
            const iconClass = iconClassMap[safeType] ?? 'i-ph:question';

            return (
              <button
                className="rounded-md justify-center px-3 py-1.5 text-xs bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent opacity-90 hover:opacity-100 flex items-center gap-2 cursor-pointer"
                data-type={type}
                data-message={message}
                data-path={path}
                data-href={href}
                onClick={() => {
                  if (type === 'file') {
                    openArtifactInWorkbench(path);
                  } else if (type === 'message' && append) {
                    append(
                      createMessage({
                        id: `quick-action-message-${Date.now()}`,
                        role: 'user',
                        text: `[Model: ${model}]\n\n[Provider: ${provider?.name}]\n\n${message}`,
                      }) as any,
                    );
                    console.log('Message appended:', message);
                  } else if (type === 'implement' && append && setChatMode) {
                    setChatMode('build');
                    append(
                      createMessage({
                        id: `quick-action-implement-${Date.now()}`,
                        role: 'user',
                        text: `[Model: ${model}]\n\n[Provider: ${provider?.name}]\n\n${message}`,
                      }) as any,
                    );
                  } else if (type === 'link' && typeof href === 'string') {
                    try {
                      const url = new URL(href, window.location.origin);
                      window.open(url.toString(), '_blank', 'noopener,noreferrer');
                    } catch (error) {
                      console.error('Invalid URL:', href, error);
                    }
                  }
                }}
              >
                <div className={`text-lg ${iconClass}`} />
                {children}
              </button>
            );
          }

          return <button {...props}>{children}</button>;
        },
      } satisfies Components;
    }, [isStreaming]);

    const remarkPluginsFn = useMemo(() => remarkPlugins(limitedMarkdown), [limitedMarkdown]);
    const rehypePluginsFn = useMemo(() => rehypePlugins(html), [html]);

    const processedContent = stripCodeFenceFromArtifact(children);

    // Split into frozen + tail blocks for streaming optimization
    const { frozen, tail } = splitBlocks(processedContent, isStreaming);

    // Update the frozen cache: grow it but never shrink mid-stream
    const cachedFrozen = frozenCacheRef.current;

    for (let i = 0; i < frozen.length; i++) {
      if (cachedFrozen[i] !== frozen[i]) {
        cachedFrozen[i] = frozen[i];
      }
    }

    // Trim if frozen shrank (shouldn't normally happen mid-stream)
    if (cachedFrozen.length > frozen.length) {
      cachedFrozen.length = frozen.length;
    }

    frozenCacheRef.current = cachedFrozen;

    return (
      <div className={styles.MarkdownContent}>
        {/* Frozen blocks — individually memoized, never re-rendered once stable */}
        {cachedFrozen.map((block, i) => (
          <FrozenBlock
            key={`frozen-${i}`}
            content={block}
            components={components}
            remarkPluginsFn={remarkPluginsFn}
            rehypePluginsFn={rehypePluginsFn}
          />
        ))}

        {/* Live tail block — re-rendered on every token */}
        <ReactMarkdown components={components} remarkPlugins={remarkPluginsFn} rehypePlugins={rehypePluginsFn}>
          {tail}
        </ReactMarkdown>
      </div>
    );
  },
);

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
};

import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import type { PluggableList, Plugin } from 'unified';
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from 'rehype-sanitize';
import { SKIP, visit } from 'unist-util-visit';
import type { UnistNode, UnistParent } from 'node_modules/unist-util-visit/lib';

export const allowedHTMLElements = [
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'ins',
  'kbd',
  'li',
  'ol',
  'p',
  'pre',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'source',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
  'var',
  'think',
];

// Add custom rehype plugin
function remarkThinkRawContent() {
  return (tree: any) => {
    try {
      visit(tree, (node: any) => {
        // Skip if node is undefined or doesn't have required properties
        if (!node || typeof node !== 'object') {
          return SKIP;
        }

        // Process opening think tag
        if (node.type === 'html' && typeof node.value === 'string' && node.value.startsWith('<think>')) {
          const cleanedContent = node.value.slice(7);
          node.value = `<div class="__boltThought__">${cleanedContent}`;

          return SKIP;
        }

        // Process closing think tag
        if (node.type === 'html' && typeof node.value === 'string' && node.value.startsWith('</think>')) {
          const cleanedContent = node.value.slice(8);
          node.value = `</div>${cleanedContent}`;

          return SKIP;
        }

        // Continue with other nodes
        return SKIP;
      });
    } catch (error) {
      console.error('Error in remarkThinkRawContent:', error);

      // Continue processing even if there's an error
    }
  };
}

const rehypeSanitizeOptions: RehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: allowedHTMLElements,
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      'data*',
      ['className', '__boltArtifact__', '__boltThought__'],

      // ['className', '__boltThought__']
    ],
  },
  strip: [],
};

export function remarkPlugins(limitedMarkdown: boolean) {
  const plugins: PluggableList = [remarkGfm];

  if (limitedMarkdown) {
    plugins.unshift(limitedMarkdownPlugin);
  }

  plugins.unshift(remarkThinkRawContent);

  return plugins;
}

export function rehypePlugins(html: boolean) {
  const plugins: PluggableList = [];

  if (html) {
    plugins.push(rehypeRaw, [rehypeSanitize, rehypeSanitizeOptions]);
  }

  return plugins;
}

const limitedMarkdownPlugin: Plugin = () => {
  return (tree, file) => {
    const contents = file.toString();

    visit(tree, (node: UnistNode, index, parent: UnistParent) => {
      if (
        index == null ||
        ['paragraph', 'text', 'inlineCode', 'code', 'strong', 'emphasis'].includes(node.type) ||
        !node.position
      ) {
        return true;
      }

      let value = contents.slice(node.position.start.offset, node.position.end.offset);

      if (node.type === 'heading') {
        value = `\n${value}`;
      }

      parent.children[index] = {
        type: 'text',
        value,
      } as any;

      return [SKIP, index] as const;
    });
  };
};

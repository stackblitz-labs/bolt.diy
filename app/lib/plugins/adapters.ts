import { jsonSchema, tool, type JSONSchema7, type ToolSet } from 'ai';
import { z } from 'zod';

export const TEXT_UTILITIES_PLUGIN_ID = 'boltdiy.text-utilities';

const schemas = {
  count: {
    type: 'object',
    properties: {
      text: { type: 'string', maxLength: 30000 },
      includeSpaces: { type: 'boolean' },
    },
    required: ['text'],
    additionalProperties: false,
  },
  transform: {
    type: 'object',
    properties: {
      text: { type: 'string', maxLength: 30000 },
      operation: { type: 'string', enum: ['trim', 'uppercase', 'lowercase', 'sort-lines', 'unique-lines'] },
    },
    required: ['text', 'operation'],
    additionalProperties: false,
  },
} satisfies Record<string, JSONSchema7>;

const inputSchemas = {
  count: z.object({ text: z.string().max(30000), includeSpaces: z.boolean().optional() }).strict(),
  transform: z
    .object({
      text: z.string().max(30000),
      operation: z.enum(['trim', 'uppercase', 'lowercase', 'sort-lines', 'unique-lines']),
    })
    .strict(),
};

function countText(text: string, includeSpaces: boolean) {
  const characters = Array.from(includeSpaces ? text : text.replace(/\s/gu, '')).length;

  return {
    characters,
    words: text.trim() ? text.trim().split(/\s+/u).length : 0,
    lines: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length,
  };
}

function transformText(text: string, operation: string): string {
  switch (operation) {
    case 'trim':
      return text.trim();
    case 'uppercase':
      return text.toLocaleUpperCase();
    case 'lowercase':
      return text.toLocaleLowerCase();
    case 'sort-lines':
      return text
        .split(/\r\n|\r|\n/u)
        .sort((left, right) => left.localeCompare(right))
        .join('\n');
    case 'unique-lines':
      return [...new Set(text.split(/\r\n|\r|\n/u))].join('\n');
    default:
      throw new Error('Unsupported text operation.');
  }
}

export type EnabledPluginAdapter = { id: string; adapter: 'text-utils'; tools: Array<'count' | 'transform'> };

export function getPluginToolName(pluginId: string, toolId: 'count' | 'transform'): string {
  let hash = 0xcbf29ce484222325n;

  for (const character of pluginId) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return `plugin_${hash.toString(16).padStart(16, '0')}_${toolId}`;
}

export function getPluginTools(plugins: EnabledPluginAdapter[], disabledTools: string[] = []): ToolSet {
  const tools: ToolSet = {};

  for (const plugin of plugins) {
    if (plugin.adapter !== 'text-utils') {
      continue;
    }

    for (const toolId of plugin.tools) {
      const name = getPluginToolName(plugin.id, toolId);

      if (disabledTools.includes(name)) {
        continue;
      }

      if (toolId === 'count') {
        tools[name] = tool({
          description: 'Count the characters, words, and lines in text provided by the user.',
          inputSchema: jsonSchema(schemas.count),
        });
      } else if (toolId === 'transform') {
        tools[name] = tool({
          description: 'Transform text provided by the user using a selected deterministic text operation.',
          inputSchema: jsonSchema(schemas.transform),
        });
      }
    }
  }

  return tools;
}

export function executeTextUtility(toolId: 'count' | 'transform', input: unknown) {
  if (toolId === 'count') {
    const parsed = inputSchemas.count.parse(input);
    return countText(parsed.text, parsed.includeSpaces ?? true);
  }

  const parsed = inputSchemas.transform.parse(input);

  return { text: transformText(parsed.text, parsed.operation) };
}

export function getPluginToolDescriptions(plugins: EnabledPluginAdapter[]) {
  return Object.fromEntries(
    plugins.flatMap((plugin) =>
      plugin.tools.map((toolId) => [
        getPluginToolName(plugin.id, toolId),
        {
          pluginId: plugin.id,
          description:
            toolId === 'count'
              ? 'Count characters, words, and lines in supplied text.'
              : 'Apply a deterministic transformation to supplied text.',
        },
      ]),
    ),
  ) as Record<string, { pluginId: string; description: string }>;
}

export function isSupportedAdapter(manifest: { id: string; contribution: { adapter: string } }) {
  return manifest.contribution.adapter === 'text-utils';
}

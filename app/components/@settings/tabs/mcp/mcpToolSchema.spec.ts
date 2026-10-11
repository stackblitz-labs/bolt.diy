import { jsonSchema } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeMcpTool, resolveToolJsonSchema, toDisplayString } from './mcpToolSchema';

const parallelSearchSchema = {
  type: 'object',
  required: ['objective', 'search_queries'],
  properties: {
    objective: { type: 'string', description: 'What the search is trying to find.' },
    search_queries: { type: 'array', items: { type: 'string' } },
  },
};

describe('resolveToolJsonSchema', () => {
  it('reads a Schema that has been through JSON serialization', () => {
    /*
     * The settings tab fetches tools over HTTP, which drops the AI SDK Schema symbol and
     * its validate function and leaves a bare { jsonSchema } object behind.
     */
    const serialized = JSON.parse(JSON.stringify(jsonSchema(parallelSearchSchema as never)));

    expect(serialized).toEqual({ jsonSchema: parallelSearchSchema });
    expect(resolveToolJsonSchema(serialized)).toEqual(parallelSearchSchema);
  });

  it('reads an in-process Schema', () => {
    expect(resolveToolJsonSchema(jsonSchema(parallelSearchSchema as never))).toEqual(parallelSearchSchema);
  });

  it('reads a Zod schema', () => {
    const resolved = resolveToolJsonSchema(z.object({ objective: z.string() }));

    expect(resolved?.type).toBe('object');
    expect(Object.keys(resolved?.properties as object)).toEqual(['objective']);
  });

  it('reads a raw JSON Schema', () => {
    expect(resolveToolJsonSchema(parallelSearchSchema)).toEqual(parallelSearchSchema);
  });

  it('resolves a lazily produced schema', () => {
    expect(resolveToolJsonSchema({ jsonSchema: () => parallelSearchSchema })).toEqual(parallelSearchSchema);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'not a schema'],
    ['a number', 42],
    ['an unresolved promise', { jsonSchema: Promise.resolve(parallelSearchSchema) }],
    [
      'a throwing getter',
      {
        get jsonSchema() {
          throw new Error('schema resolution failed');
        },
      },
    ],
    [
      'a throwing factory',
      {
        jsonSchema: () => {
          throw new Error('schema resolution failed');
        },
      },
    ],
  ])('returns nothing for %s', (_label, input) => {
    expect(resolveToolJsonSchema(input)).toBeUndefined();
  });

  it('gives up on a self-referencing schema instead of recursing forever', () => {
    const circular: Record<string, unknown> = {};
    circular.jsonSchema = circular;

    expect(resolveToolJsonSchema(circular)).toBeUndefined();
  });
});

describe('toDisplayString', () => {
  it.each([
    ['keeps strings', 'string', 'string'],
    ['stringifies numbers', 7, '7'],
    ['stringifies booleans', false, 'false'],
    ['serializes arrays', ['string', 'null'], '["string","null"]'],
    ['serializes objects', { text: 'hi' }, '{"text":"hi"}'],
  ])('%s', (_label, input, expected) => {
    expect(toDisplayString(input)).toBe(expected);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', '   '],
    ['a function', () => 'nope'],
    ['a symbol', Symbol('nope')],
  ])('skips %s', (_label, input) => {
    expect(toDisplayString(input)).toBeUndefined();
  });

  it('skips values that cannot be serialized', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(toDisplayString(circular)).toBeUndefined();
  });
});

describe('describeMcpTool', () => {
  it('describes a Parallel Search tool as the settings tab receives it', () => {
    const details = describeMcpTool({
      description: 'Search the web.',
      inputSchema: { jsonSchema: parallelSearchSchema },
    });

    expect(details).toEqual({
      description: 'Search the web.',
      parameters: [
        { name: 'objective', required: true, type: 'string', description: 'What the search is trying to find.' },
        { name: 'search_queries', required: true, type: 'array', description: undefined },
      ],
    });
  });

  it('labels union types', () => {
    const details = describeMcpTool({
      inputSchema: {
        jsonSchema: {
          properties: {
            tuple: { type: ['string', 'null'] },
            union: { anyOf: [{ type: 'array' }, { type: 'null' }] },
            either: { oneOf: [{ type: 'string' }, { type: 'string' }] },
            unknown: { anyOf: [{ const: 'a' }, { const: 'b' }] },
          },
        },
      },
    });

    expect(details.parameters.map((parameter) => parameter.type)).toEqual([
      'string | null',
      'array | null',
      'string',
      undefined,
    ]);
  });

  it('keeps non-string parameter descriptions renderable', () => {
    const details = describeMcpTool({
      inputSchema: { jsonSchema: { properties: { filters: { type: 'object', description: { text: 'nested' } } } } },
    });

    expect(details.parameters[0].description).toBe('{"text":"nested"}');
  });

  it('ignores a required list that is not an array of names', () => {
    const details = describeMcpTool({
      inputSchema: { jsonSchema: { required: 'objective', properties: { objective: { type: 'string' } } } },
    });

    expect(details.parameters[0].required).toBe(false);
  });

  it.each([
    ['a tool without a schema', {}],
    ['a tool with a callable description', { description: () => 'nope' }],
    ['a null tool', null],
    ['a string tool', 'nope'],
    ['a tool whose properties are not an object', { inputSchema: { jsonSchema: { properties: ['objective'] } } }],
  ])('returns an empty description for %s', (_label, input) => {
    expect(describeMcpTool(input)).toEqual({ description: undefined, parameters: [] });
  });
});

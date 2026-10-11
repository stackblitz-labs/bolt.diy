import { asSchema } from 'ai';

export type McpToolParameter = {
  name: string;
  required: boolean;
  type?: string;
  description?: string;
};

export type McpToolDetails = {
  description?: string;
  parameters: McpToolParameter[];
};

/*
 * Guards against a schema that wraps itself, which would otherwise recurse until the
 * stack runs out.
 */
const MAX_UNWRAP_DEPTH = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isThenable(value: unknown): boolean {
  return isRecord(value) && typeof value.then === 'function';
}

function readProperty(value: Record<string, unknown>, key: string): unknown {
  // Getters can throw, and a tool list is not worth a crash.
  try {
    return value[key];
  } catch {
    return undefined;
  }
}

function unwrapJsonSchema(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (value == null || depth > MAX_UNWRAP_DEPTH) {
    return undefined;
  }

  if (typeof value === 'function') {
    try {
      return unwrapJsonSchema((value as () => unknown)(), depth + 1);
    } catch {
      return undefined;
    }
  }

  if (!isRecord(value) || isThenable(value)) {
    return undefined;
  }

  if ('jsonSchema' in value) {
    return unwrapJsonSchema(readProperty(value, 'jsonSchema'), depth + 1);
  }

  return value;
}

/**
 * Reads the JSON Schema behind a tool's `inputSchema` without ever throwing.
 *
 * `asSchema` only accepts a live Schema, Zod schema or lazy factory. Tools rendered in
 * settings have crossed the `/api/mcp-*` JSON boundary, which strips the Schema symbol and
 * leaves a bare `{ jsonSchema }` object, so `asSchema` would treat it as a factory and call
 * it. Unwrap that shape directly and keep `asSchema` for the in-process cases.
 */
export function resolveToolJsonSchema(inputSchema: unknown): Record<string, unknown> | undefined {
  if (isRecord(inputSchema) && '~standard' in inputSchema) {
    try {
      return unwrapJsonSchema(asSchema(inputSchema as never));
    } catch {
      return undefined;
    }
  }

  return unwrapJsonSchema(inputSchema);
}

/** Turns an arbitrary schema value into something React can render, or nothing. */
export function toDisplayString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value.trim() === '' ? undefined : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }

  if (value == null || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  try {
    return JSON.stringify(value) ?? undefined;
  } catch {
    return undefined;
  }
}

function joinTypeNames(values: unknown[]): string | undefined {
  const names = values.map(toDisplayString).filter((name): name is string => name !== undefined);

  if (names.length === 0 || names.length !== values.length) {
    return undefined;
  }

  return [...new Set(names)].join(' | ');
}

function toTypeLabel(property: Record<string, unknown>): string | undefined {
  const declared = readProperty(property, 'type');

  if (Array.isArray(declared)) {
    return joinTypeNames(declared) ?? toDisplayString(declared);
  }

  const label = toDisplayString(declared);

  if (label !== undefined) {
    return label;
  }

  // A property may describe itself only through a union, as Parallel's web_fetch does.
  const variants = readProperty(property, 'anyOf') ?? readProperty(property, 'oneOf');

  if (Array.isArray(variants)) {
    return joinTypeNames(variants.map((variant) => (isRecord(variant) ? readProperty(variant, 'type') : undefined)));
  }

  return undefined;
}

function toParameters(schema: Record<string, unknown> | undefined): McpToolParameter[] {
  const properties = schema && readProperty(schema, 'properties');

  if (!isRecord(properties)) {
    return [];
  }

  const declaredRequired = schema && readProperty(schema, 'required');

  const required = new Set(
    Array.isArray(declaredRequired) ? declaredRequired.filter((name): name is string => typeof name === 'string') : [],
  );

  return Object.entries(properties).map(([name, property]) => ({
    name,
    required: required.has(name),
    type: isRecord(property) ? toTypeLabel(property) : undefined,
    description: isRecord(property) ? toDisplayString(readProperty(property, 'description')) : undefined,
  }));
}

/**
 * Describes a tool for display. Any tool shape is accepted, including ones that never came
 * from a well-behaved MCP server.
 */
export function describeMcpTool(toolSchema: unknown): McpToolDetails {
  if (!isRecord(toolSchema)) {
    return { parameters: [] };
  }

  return {
    description: toDisplayString(readProperty(toolSchema, 'description')),
    parameters: toParameters(resolveToolJsonSchema(readProperty(toolSchema, 'inputSchema'))),
  };
}

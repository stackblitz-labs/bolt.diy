import { vi } from 'vitest';

vi.mock('ollama-ai-provider', () => ({ ollama: vi.fn() }));
vi.mock('@ai-sdk/provider-utils', () => ({}));

// style-to-js depends on style-to-object ESM; stub both
vi.mock('style-to-object', () => ({ __esModule: true, default: () => ({}) }));
vi.mock('style-to-js', () => ({ __esModule: true, default: () => ({}) }));

// Multipart parser ESM stubs
vi.mock('@web3-storage/multipart-parser', () => ({}));
vi.mock('@web3-storage/multipart-parser/esm/src/index.js', () => ({}));

// AWS smithy core (ESM) stub to avoid missing module resolution
vi.mock('@smithy/core', () => ({
  __esModule: true,
  getSmithyContext: () => ({}),
}));
vi.mock('@smithy/core/dist-es/getSmithyContext', () => ({
  __esModule: true,
  default: () => ({}),
}));
vi.mock('@smithy/core/dist-es/index.js', () => ({
  __esModule: true,
  getSmithyContext: () => ({}),
}));


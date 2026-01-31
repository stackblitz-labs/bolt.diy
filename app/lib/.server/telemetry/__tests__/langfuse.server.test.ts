/**
 * Unit Tests for Langfuse Telemetry Module
 *
 * Tests the langfuse.server.ts module functions:
 * - getLangfuseClient: singleton client management
 * - isLangfuseEnabled: environment check
 * - createTrace: trace creation
 * - createGeneration: generation span creation
 * - flushTraces: async flush
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before imports
vi.mock('~/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Langfuse SDK
const mockEnd = vi.fn();
const mockTrace = vi.fn(() => ({ id: 'mock-trace-id' }));
const mockGeneration = vi.fn(() => ({
  id: 'mock-gen-id',
  end: mockEnd,
}));
const mockFlushAsync = vi.fn();

vi.mock('langfuse', () => ({
  Langfuse: vi.fn(() => ({
    trace: mockTrace,
    generation: mockGeneration,
    flushAsync: mockFlushAsync,
  })),
}));

// Import after mocks are set up
import { isLangfuseEnabled } from '~/lib/.server/telemetry/langfuse.server';

describe('langfuse.server', () => {
  // Valid env configuration
  const validEnv: Env = {
    LANGFUSE_ENABLED: 'true',
    LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
    LANGFUSE_SECRET_KEY: 'sk-lf-test',
  } as Env;

  // Disabled env configuration
  const disabledEnv: Env = {
    LANGFUSE_ENABLED: 'false',
    LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
    LANGFUSE_SECRET_KEY: 'sk-lf-test',
  } as Env;

  // Missing credentials env
  const missingCredsEnv: Env = {
    LANGFUSE_ENABLED: 'true',
  } as Env;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset module to clear singleton
    vi.resetModules();

    // Clear process.env Langfuse variables to prevent fallback interference
    delete process.env.LANGFUSE_ENABLED;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
  });

  describe('getLangfuseClient', () => {
    it('returns null when LANGFUSE_ENABLED is false', async () => {
      const { getLangfuseClient } = await import('~/lib/.server/telemetry/langfuse.server');
      const client = getLangfuseClient(disabledEnv);
      expect(client).toBeNull();
    });

    it('returns null when credentials are missing', async () => {
      const { getLangfuseClient } = await import('~/lib/.server/telemetry/langfuse.server');
      const client = getLangfuseClient(missingCredsEnv);
      expect(client).toBeNull();
    });

    it('returns singleton instance when properly configured', async () => {
      const { getLangfuseClient } = await import('~/lib/.server/telemetry/langfuse.server');
      const client1 = getLangfuseClient(validEnv);
      const client2 = getLangfuseClient(validEnv);

      expect(client1).not.toBeNull();
      expect(client1).toBe(client2); // Same instance
    });

    it('returns null when env is undefined', async () => {
      const { getLangfuseClient } = await import('~/lib/.server/telemetry/langfuse.server');
      const client = getLangfuseClient(undefined);
      expect(client).toBeNull();
    });
  });

  describe('isLangfuseEnabled', () => {
    it('returns true with valid env configuration', () => {
      const result = isLangfuseEnabled(validEnv);
      expect(result).toBe(true);
    });

    it('returns false when LANGFUSE_ENABLED is false', () => {
      const result = isLangfuseEnabled(disabledEnv);
      expect(result).toBe(false);
    });

    it('returns false when credentials are missing', () => {
      const result = isLangfuseEnabled(missingCredsEnv);
      expect(result).toBe(false);
    });

    it('returns false when env is undefined', () => {
      const result = isLangfuseEnabled(undefined);
      expect(result).toBe(false);
    });

    it('returns false when only public key is present', () => {
      const partialEnv: Env = {
        LANGFUSE_ENABLED: 'true',
        LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
      } as Env;
      const result = isLangfuseEnabled(partialEnv);
      expect(result).toBe(false);
    });
  });

  describe('createTrace', () => {
    it('returns null when client is unavailable', async () => {
      const { createTrace } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createTrace(disabledEnv, {
        name: 'test-trace',
      });
      expect(result).toBeNull();
    });

    it('returns trace context on success', async () => {
      const { createTrace } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createTrace(validEnv, {
        name: 'test-trace',
        userId: 'user-123',
        sessionId: 'session-456',
      });

      expect(result).not.toBeNull();
      expect(result?.traceId).toBe('mock-trace-id');
      expect(result?.userId).toBe('user-123');
      expect(result?.sessionId).toBe('session-456');
    });

    it('passes metadata and input to trace', async () => {
      const { createTrace } = await import('~/lib/.server/telemetry/langfuse.server');
      createTrace(validEnv, {
        name: 'test-trace',
        metadata: { foo: 'bar' },
        input: { message: 'hello' },
      });

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-trace',
          metadata: { foo: 'bar' },
          input: { message: 'hello' },
        }),
      );
    });

    it('handles errors gracefully', async () => {
      // Make trace throw an error
      mockTrace.mockImplementationOnce(() => {
        throw new Error('Trace failed');
      });

      const { createTrace } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createTrace(validEnv, {
        name: 'test-trace',
      });

      expect(result).toBeNull();
    });
  });

  describe('createGeneration', () => {
    const traceContext = {
      traceId: 'trace-123',
      userId: 'user-123',
      sessionId: 'session-456',
    };

    it('returns null when client is unavailable', async () => {
      const { createGeneration } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createGeneration(disabledEnv, traceContext, {
        name: 'test-gen',
        model: 'gpt-4',
      });
      expect(result).toBeNull();
    });

    it('returns object with generationId and end callback', async () => {
      const { createGeneration } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createGeneration(validEnv, traceContext, {
        name: 'test-gen',
        model: 'gpt-4',
      });

      expect(result).not.toBeNull();
      expect(result?.generationId).toBe('mock-gen-id');
      expect(typeof result?.end).toBe('function');
    });

    it('end callback calls generation.end with metadata', async () => {
      const { createGeneration } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createGeneration(validEnv, traceContext, {
        name: 'test-gen',
        model: 'gpt-4',
      });

      result?.end({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        output: 'test output',
        provider: 'openai',
        finishReason: 'stop',
      });

      expect(mockEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          output: 'test output',
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
          metadata: {
            provider: 'openai',
            finishReason: 'stop',
          },
        }),
      );
    });

    it('end callback handles errors gracefully', async () => {
      mockEnd.mockImplementationOnce(() => {
        throw new Error('End failed');
      });

      const { createGeneration } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createGeneration(validEnv, traceContext, {
        name: 'test-gen',
        model: 'gpt-4',
      });

      // Should not throw
      expect(() =>
        result?.end({
          output: 'test',
          provider: 'openai',
        }),
      ).not.toThrow();
    });

    it('handles creation errors gracefully', async () => {
      mockGeneration.mockImplementationOnce(() => {
        throw new Error('Generation failed');
      });

      const { createGeneration } = await import('~/lib/.server/telemetry/langfuse.server');
      const result = createGeneration(validEnv, traceContext, {
        name: 'test-gen',
        model: 'gpt-4',
      });

      expect(result).toBeNull();
    });

    it('uses provided startTime', async () => {
      const startTime = new Date('2024-01-01');
      const { createGeneration } = await import('~/lib/.server/telemetry/langfuse.server');
      createGeneration(validEnv, traceContext, {
        name: 'test-gen',
        model: 'gpt-4',
        startTime,
      });

      expect(mockGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime,
        }),
      );
    });
  });

  describe('flushTraces', () => {
    it('returns early when client is unavailable', async () => {
      const { flushTraces } = await import('~/lib/.server/telemetry/langfuse.server');
      await flushTraces(disabledEnv);
      expect(mockFlushAsync).not.toHaveBeenCalled();
    });

    it('calls flushAsync on client', async () => {
      const { flushTraces, getLangfuseClient } = await import('~/lib/.server/telemetry/langfuse.server');

      // Initialize client first
      getLangfuseClient(validEnv);
      await flushTraces(validEnv);
      expect(mockFlushAsync).toHaveBeenCalled();
    });

    it('completes without throwing on error', async () => {
      mockFlushAsync.mockRejectedValueOnce(new Error('Flush failed'));

      const { flushTraces, getLangfuseClient } = await import('~/lib/.server/telemetry/langfuse.server');

      // Initialize client first
      getLangfuseClient(validEnv);

      // Should not throw
      await expect(flushTraces(validEnv)).resolves.toBeUndefined();
    });
  });
});

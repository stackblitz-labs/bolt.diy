import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, createScopedLogger } from './logger';

describe('logger', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    logger.setLevel('debug'); // Reset to default
  });

  describe('basic logging', () => {
    it('should log trace messages', () => {
      logger.setLevel('trace');
      logger.trace('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log debug messages', () => {
      logger.setLevel('debug');
      logger.debug('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('log levels', () => {
    it('should not log trace when level is debug', () => {
      logger.setLevel('debug');
      logger.trace('should not appear');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log debug when level is info', () => {
      logger.setLevel('info');
      logger.debug('should not appear');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log info when level is warn', () => {
      logger.setLevel('warn');
      logger.info('should not appear');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log warn when level is error', () => {
      logger.setLevel('error');
      logger.warn('should not appear');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should not log anything when level is none', () => {
      logger.setLevel('none');
      logger.error('should not appear');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log error when level is error', () => {
      logger.setLevel('error');
      logger.error('should appear');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('multiple arguments', () => {
    it('should handle multiple string arguments', () => {
      logger.info('first', 'second', 'third');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle mixed argument types', () => {
      logger.info('string', 123, { key: 'value' }, [1, 2, 3]);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('scoped logger', () => {
    it('should create scoped logger', () => {
      const scopedLogger = createScopedLogger('TestScope');
      expect(scopedLogger).toBeDefined();
      expect(scopedLogger.info).toBeDefined();
    });

    it('should log with scope', () => {
      const scopedLogger = createScopedLogger('TestScope');
      scopedLogger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should respect log levels', () => {
      const scopedLogger = createScopedLogger('TestScope');
      logger.setLevel('error');
      scopedLogger.info('should not appear');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log errors even at error level', () => {
      const scopedLogger = createScopedLogger('TestScope');
      logger.setLevel('error');
      scopedLogger.error('should appear');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      logger.info();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle null and undefined as strings', () => {
      // Logger converts them to strings internally
      logger.info('null value:', null);
      logger.info('undefined value:', undefined);
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle objects', () => {
      logger.info({ key: 'value', nested: { data: 123 } });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle arrays', () => {
      logger.info([1, 2, 3, 'test', { key: 'value' }]);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle errors', () => {
      const error = new Error('Test error');
      logger.error(error);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});

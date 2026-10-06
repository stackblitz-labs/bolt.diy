import { describe, it, expect } from 'vitest';
import { classNames } from './classNames';

describe('classNames', () => {
  it('should handle string arguments', () => {
    expect(classNames('foo', 'bar')).toBe('foo bar');
  });

  it('should handle single string', () => {
    expect(classNames('foo')).toBe('foo');
  });

  it('should handle empty arguments', () => {
    expect(classNames()).toBe('');
  });

  it('should ignore null and undefined', () => {
    expect(classNames('foo', null, 'bar', undefined)).toBe('foo bar');
  });

  it('should ignore false and true', () => {
    expect(classNames('foo', false, 'bar', true)).toBe('foo bar');
  });

  it('should handle object with boolean values', () => {
    expect(classNames({ foo: true, bar: false, baz: true })).toBe('foo baz');
  });

  it('should handle mixed arguments', () => {
    expect(classNames('foo', { bar: true, baz: false }, null, undefined, 'qux')).toBe('foo bar qux');
  });

  it('should handle number arguments', () => {
    expect(classNames(1, 2, 3)).toBe('1 2 3');
  });

  it('should handle array arguments', () => {
    expect(classNames(['foo', 'bar'])).toBe('foo bar');
  });

  it('should handle nested arrays', () => {
    expect(classNames(['foo', ['bar', 'baz']])).toBe('foo bar baz');
  });

  it('should handle complex nested structures', () => {
    expect(
      classNames('foo', ['bar', { baz: true, qux: false }], { active: true, disabled: false }, null, 'final'),
    ).toBe('foo bar baz active final');
  });

  it('should handle empty strings', () => {
    expect(classNames('', 'foo', '')).toBe('foo');
  });

  it('should handle all falsy values', () => {
    expect(classNames(null, undefined, false, 0, '')).toBe('0');
  });

  it('should handle object with all false values', () => {
    expect(classNames({ foo: false, bar: false })).toBe('');
  });

  it('should handle real-world example', () => {
    const isActive = true;
    const isDisabled = false;
    const hasError = true;

    expect(
      classNames('button', 'button-primary', {
        'button-active': isActive,
        'button-disabled': isDisabled,
        'button-error': hasError,
      }),
    ).toBe('button button-primary button-active button-error');
  });

  it('should handle conditional rendering pattern', () => {
    const condition = true;
    expect(classNames('base', condition && 'conditional')).toBe('base conditional');
  });

  it('should handle conditional rendering pattern with false', () => {
    const condition = false;
    expect(classNames('base', condition && 'conditional')).toBe('base');
  });

  it('should not add extra spaces', () => {
    expect(classNames('foo', '', 'bar')).toBe('foo bar');
    expect(classNames('', 'foo', '', 'bar', '')).toBe('foo bar');
  });
});

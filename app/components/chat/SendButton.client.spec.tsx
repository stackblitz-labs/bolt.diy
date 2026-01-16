import { render, screen, cleanup } from '@testing-library/react';
import { SendButton } from './SendButton.client';
import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// @vitest-environment jsdom

describe('SendButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('has correct label when not streaming', () => {
    render(<SendButton show={true} isStreaming={false} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Send');
    expect(button).toHaveAttribute('title', 'Send');
  });

  it('has correct label when streaming', () => {
    render(<SendButton show={true} isStreaming={true} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Stop generation');
    expect(button).toHaveAttribute('title', 'Stop generation');
  });
});

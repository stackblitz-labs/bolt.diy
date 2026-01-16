import { render, screen, cleanup } from '@testing-library/react';
import { IconButton } from './IconButton';
import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// @vitest-environment jsdom

describe('IconButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses ariaLabel when provided', () => {
    render(<IconButton icon="i-ph:user" ariaLabel="User Profile" />);
    expect(screen.getByRole('button', { name: /User Profile/i })).toBeInTheDocument();
  });

  it('falls back to title for aria-label', () => {
    render(<IconButton icon="i-ph:user" title="User Settings" />);
    expect(screen.getByRole('button', { name: /User Settings/i })).toBeInTheDocument();
  });

  it('prefers ariaLabel over title', () => {
    render(<IconButton icon="i-ph:user" title="Tooltip Text" ariaLabel="Accessible Text" />);
    expect(screen.getByRole('button', { name: /Accessible Text/i })).toBeInTheDocument();
  });
});

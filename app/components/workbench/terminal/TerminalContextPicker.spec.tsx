import { fireEvent, render, screen } from '@testing-library/react';
import type { Terminal } from '@xterm/xterm';
import { beforeEach, describe, expect, it } from 'vitest';
import { TerminalContextPicker } from './TerminalContextPicker';
import { TerminalAttachments } from '~/components/chat/TerminalAttachments';
import {
  recordTerminalCommand,
  resetTerminalContext,
  terminalAttachments,
  terminalContextGeneration,
} from '~/lib/stores/terminalContext';

beforeEach(() => resetTerminalContext());

describe('terminal attachments', () => {
  const terminal = {
    getSelection: () => 'API_KEY=secret\nselected output',
    buffer: {
      active: {
        length: 2,
        getLine: (index: number) => ({
          isWrapped: false,
          translateToString: () => ['first line', 'second line'][index],
        }),
      },
    },
  } as unknown as Terminal;

  it('attaches only selected output and allows preview and removal', () => {
    render(
      <>
        <TerminalContextPicker terminal={() => terminal} label="Terminal 1" isBolt={false} />
        <TerminalAttachments />
      </>,
    );
    expect(terminalAttachments.get()).toHaveLength(0);
    fireEvent.click(screen.getByText('Add to chat'));
    fireEvent.click(screen.getByText('Selected output'));
    expect(terminalAttachments.get()[0].text).toBe('API_KEY=[REDACTED]\nselected output');
    fireEvent.click(screen.getByText(/Terminal 1 · selection/));
    expect(screen.getByText(/selected output/)).toBeTruthy();
    fireEvent.click(screen.getByText('Remove'));
    expect(terminalAttachments.get()).toHaveLength(0);
  });

  it('offers the completed failing Bolt command without attaching it automatically', () => {
    recordTerminalCommand('npm test', 'test failed', 1, terminalContextGeneration());
    render(<TerminalContextPicker terminal={() => terminal} label="Bolt Terminal" isBolt />);
    expect(terminalAttachments.get()).toHaveLength(0);
    fireEvent.click(screen.getByText('Add to chat'));
    fireEvent.click(screen.getByText('Add last error to chat'));
    expect(terminalAttachments.get()[0].text).toContain('$ npm test\ntest failed\nExit code: 1');
  });
});

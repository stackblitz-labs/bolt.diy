import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromptQueue, type PromptQueueControls } from './PromptQueue';

describe('PromptQueue', () => {
  it('lets users edit, reorder, remove, and resume queued prompts', () => {
    const queue: PromptQueueControls = {
      items: [
        { id: 1, text: 'First' },
        { id: 2, text: 'Second' },
      ],
      paused: true,
      canAdd: true,
      add: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      resume: vi.fn(),
    };

    render(<PromptQueue queue={queue} />);
    fireEvent.change(screen.getByLabelText('Queued prompt 1'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByLabelText('Move prompt 2 up'));
    fireEvent.click(screen.getByLabelText('Remove prompt 1'));
    fireEvent.click(screen.getByText('Resume'));

    expect(queue.update).toHaveBeenCalledWith(1, 'Edited');
    expect(queue.move).toHaveBeenCalledWith(2, -1);
    expect(queue.remove).toHaveBeenCalledWith(1);
    expect(queue.resume).toHaveBeenCalledOnce();
  });
});

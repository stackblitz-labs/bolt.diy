import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkbenchReopenButton } from './WorkbenchReopenButton';

describe('WorkbenchReopenButton', () => {
  it('provides an accessible control that reopens the workbench', () => {
    const onClick = vi.fn();

    render(<WorkbenchReopenButton onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open workbench' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});

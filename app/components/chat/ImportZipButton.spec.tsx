import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportZipButton } from './ImportZipButton';

const { createZip, toastSuccess } = vi.hoisted(() => ({
  createZip: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('~/utils/zipImport', () => ({ createChatFromZip: createZip }));
vi.mock('react-toastify', () => ({
  toast: {
    loading: vi.fn(),
    dismiss: vi.fn(),
    success: toastSuccess,
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('ImportZipButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    createZip.mockResolvedValue({
      messages: [],
      skippedBinary: 0,
      skippedIgnored: 0,
      totalFiles: 1,
      hasPackageJson: true,
      hasExpoConfig: false,
    });
  });

  it('does not leave an autorun prompt when no chat import handler is available', async () => {
    const { container } = render(<ImportZipButton />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(['zip'], 'project.zip')] } });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('ZIP imported successfully'));

    expect(localStorage.getItem('bolt_zip_autorun')).toBeNull();
  });
});

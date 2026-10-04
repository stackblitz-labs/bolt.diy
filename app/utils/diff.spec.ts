import { describe, expect, it } from 'vitest';
import { WORK_DIR } from './constants';
import { extractRelativePath } from './diff';

describe('Diff', () => {
  it('should strip out Work_dir', () => {
    const filePath = `${WORK_DIR}/index.js`;
    const result = extractRelativePath(filePath);
    expect(result).toBe('index.js');
  });
});

import type { FileMap } from '~/lib/stores/files';

export interface Snapshot {
  chatIndex: string;
  files: FileMap;
  summary?: string;
  created_at?: string;
  updated_at?: string;
}

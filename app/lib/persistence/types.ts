import type { FileMap } from "../stores/files";

export interface Snapshot {
    chatIndex: number,
    files: FileMap
}
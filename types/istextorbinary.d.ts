/**
 * @note For some reason the types aren't picked up from node_modules so I declared the module here
 * with only the function that we use.
 */
declare module 'istextorbinary' {
  export interface EncodingOpts {
    /** Defaults to 24 */
    chunkLength?: number;

    /** If not provided, will check the start, beginning, and end */
    chunkBegin?: number;
  }

  export function getEncoding(buffer: Buffer | null, opts?: EncodingOpts): 'utf8' | 'binary' | null;
}

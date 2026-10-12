import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

const packageEntry = fileURLToPath(import.meta.resolve('ripgrep'));
const wasmModulePath = join(dirname(packageEntry), '_rg.wasm.mjs');
const { getCompressedBytes } = await import(pathToFileURL(wasmModulePath).href);
const wasmBytes = brotliDecompressSync(getCompressedBytes());
const outputPath = fileURLToPath(new URL('../public/rg.wasm', import.meta.url));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, wasmBytes);
console.log(`Wrote ${wasmBytes.byteLength} bytes to ${outputPath}`);

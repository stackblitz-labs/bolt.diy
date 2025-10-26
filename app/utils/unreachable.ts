export function unreachable(message: string): never {
  throw new Error(`Unreachable: ${message}`);
}

let env: Record<string, string> = {};

export function setEnv(nextEnv: Record<string, string>) {
  env = nextEnv;
}

export function getEnv(): Record<string, string> {
  return env;
}

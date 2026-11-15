const MAX_BUILD_OUTPUT_CHARS = 4000;

export function formatBuildFailureOutput(output?: string) {
  const trimmed = output?.trim();

  if (!trimmed) {
    return 'Build failed with no output captured.';
  }

  if (trimmed.length <= MAX_BUILD_OUTPUT_CHARS) {
    return trimmed;
  }

  return `Build output (truncated):\n${trimmed.slice(-MAX_BUILD_OUTPUT_CHARS)}`;
}

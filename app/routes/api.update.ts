import { json, type ActionFunction } from '@remix-run/cloudflare';
import { execSync } from 'child_process';

// Helper function to safely execute git commands
function safeExecSync(command: string): string {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Parse request body to get branch info
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const branch = (body.branch as string) ?? 'main';

  /*
   * For server environments, updates must be performed manually,
   * but we can still provide some useful information about the current state
   */
  // Try to get current git information if available
  let currentCommit = 'unknown';
  let currentBranch = 'unknown';
  let latestCommitMessage = '';
  let updateInstructions = [
    '1. Navigate to the project directory',
    '2. Run: git fetch upstream',
    '3. Run: git pull upstream main',
    '4. Run: pnpm install',
    '5. Run: pnpm run build',
  ];

  try {
    // Get current git information
    currentCommit = safeExecSync('git rev-parse HEAD');
    currentBranch = safeExecSync('git rev-parse --abbrev-ref HEAD');
    latestCommitMessage = safeExecSync('git log -1 --pretty=%B');

    // Customize instructions based on current branch
    if (currentBranch && currentBranch !== 'unknown') {
      updateInstructions = [
        '1. Navigate to the project directory',
        '2. Run: git fetch upstream',
        `3. Run: git pull upstream ${currentBranch}`,
        '4. Run: pnpm install',
        '5. Run: pnpm run build',
      ];
    }
  } catch {
    // Git commands failed, use default values
  }

  return json(
    {
      stage: 'complete',
      message: 'Update check completed',
      details: {
        updateReady: false,
        currentCommit: currentCommit !== 'unknown' ? currentCommit.substring(0, 7) : 'unknown',
        currentBranch,
        latestCommitMessage,
        changelog:
          'Updates must be performed manually in a server environment.\n\n' +
          'This installation appears to be running in a server environment where automatic updates are not possible. ' +
          'Please follow the manual update instructions below to keep your installation up to date.',
      },
      instructions: updateInstructions,
    },
    { status: 200 },
  );
};

import type { ActionFunction } from 'react-router';

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  return Response.json(
    {
      error: 'Updates must be performed manually in a server environment',
      instructions: [
        '1. Navigate to the project directory',
        '2. Run: git fetch upstream',
        '3. Run: git pull upstream main',
        '4. Run: pnpm install',
        '5. Run: pnpm run build',
      ],
    },
    { status: 400 },
  );
};

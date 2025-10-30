import { json, type ActionFunctionArgs } from '~/lib/remix-types';
import { createClient } from '@supabase/supabase-js';

// 🔒 SECURITY: Helper function to get authenticated user
async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

async function pingTelemetry(event: string, data: any, userId: string): Promise<boolean> {
  console.log('PingTelemetry', event, data);

  try {
    const response = await fetch('https://telemetry.replay.io/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event,
        ...data,
        userId, // Include authenticated userId to prevent spoofing
      }),
    });

    if (!response.ok) {
      console.error(`Telemetry request returned unexpected status: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telemetry request failed:', error);
    return false;
  }
}

export async function action(args: ActionFunctionArgs) {
  return pingTelemetryAction(args);
}

async function pingTelemetryAction({ request }: ActionFunctionArgs) {
  // 🔒 SECURITY: Authenticate the user
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return json({ error: 'Authentication required' }, { status: 401 });
  }

  const { event, data } = (await request.json()) as {
    event: string;
    data: any;
  };

  // Validate event name to prevent injection
  if (!event || typeof event !== 'string' || event.length > 100) {
    return json({ error: 'Invalid event name' }, { status: 400 });
  }

  const success = await pingTelemetry(event, data, user.id);

  return json({ success });
}

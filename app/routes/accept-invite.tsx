import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { getSupabaseAuthClientServer } from '~/lib/api/supabase-auth-client';
import { withSecurity } from '~/lib/security';
import { useState } from 'react';
import { useAuth } from '~/lib/hooks/useAuth';
import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { Button } from '~/components/ui/Button';

async function acceptInviteLoader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return json({ error: 'No invitation token provided', invitation: null });
  }

  try {
    const supabase = getSupabaseAuthClientServer(context);

    // Get invitation details (without auth, so user can see invitation before logging in)
    const { data: invitation, error: invitationError } = await supabase
      .from('workspace_invitations')
      .select('*, workspace:workspaces(id, name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (invitationError || !invitation) {
      return json({ error: 'Invitation not found or already used', invitation: null });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return json({ error: 'Invitation has expired', invitation: null });
    }

    return json({ error: null, invitation });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : 'Failed to load invitation',
      invitation: null,
    });
  }
}

export const loader = withSecurity(acceptInviteLoader, {
  rateLimit: true,
  allowedMethods: ['GET'],
});

type LoaderData = {
  error: string | null;
  invitation: {
    id: string;
    workspace_id: string;
    email: string;
    token: string;
    status: string;
    expires_at: string;
    workspace: { id: string; name: string } | null;
  } | null;
};

export default function AcceptInvite() {
  const loaderData = useLoaderData<typeof loader>() as LoaderData;
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { acceptInvitation } = useWorkspace();
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!loaderData.invitation) {
      return;
    }

    if (!isAuthenticated) {
      setError('Please log in to accept the invitation');
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      await acceptInvitation(loaderData.invitation.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setIsAccepting(false);
    }
  };

  if (loaderData.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background">
        <div className="max-w-md w-full mx-4 p-6 bg-bolt-elements-bg-depth-1 rounded-lg border border-bolt-elements-border shadow-xl">
          <h1 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Invitation Error</h1>
          <p className="text-bolt-elements-textSecondary">{loaderData.error}</p>
          <a href="/" className="mt-4 inline-block text-accent-500 hover:text-accent-600 transition-colors">
            Go to home
          </a>
        </div>
      </div>
    );
  }

  if (!loaderData.invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background">
        <div className="max-w-md w-full mx-4 p-6 bg-bolt-elements-bg-depth-1 rounded-lg border border-bolt-elements-border shadow-xl">
          <h1 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Invalid Invitation</h1>
          <p className="text-bolt-elements-textSecondary">This invitation is not valid or has expired.</p>
          <a href="/" className="mt-4 inline-block text-accent-500 hover:text-accent-600 transition-colors">
            Go to home
          </a>
        </div>
      </div>
    );
  }

  const invitation = loaderData.invitation;
  const workspace = invitation.workspace as { id: string; name: string } | null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background">
      <div className="max-w-md w-full mx-4 p-6 bg-bolt-elements-bg-depth-1 rounded-lg border border-bolt-elements-border shadow-xl">
        <h1 className="text-xl font-semibold text-bolt-elements-textPrimary mb-4">Workspace Invitation</h1>
        <p className="text-bolt-elements-textSecondary mb-6">
          You've been invited to join <strong className="text-bolt-elements-textPrimary">{workspace?.name}</strong>
        </p>

        {!isAuthenticated && (
          <div className="mb-4 p-3 rounded-md bg-bolt-elements-item-backgroundWarning border border-bolt-elements-borderColor">
            <p className="text-sm text-bolt-elements-item-contentWarning">Please log in to accept this invitation.</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-md bg-bolt-elements-item-backgroundDanger border border-bolt-elements-borderColor">
            <p className="text-sm text-bolt-elements-item-contentDanger">{error}</p>
          </div>
        )}

        <Button
          onClick={handleAccept}
          disabled={!isAuthenticated || isAccepting}
          className="w-full bg-accent-500 hover:bg-accent-600 text-white font-medium py-2.5 transition-colors"
        >
          {isAccepting ? 'Accepting...' : isAuthenticated ? 'Accept Invitation' : 'Log in to Accept'}
        </Button>
        <a
          href="/"
          className="mt-4 inline-block text-center w-full text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
        >
          Cancel
        </a>
      </div>
    </div>
  );
}

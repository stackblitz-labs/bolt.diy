import { useState } from 'react';
import { useWorkspace } from '~/lib/hooks/useWorkspace';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { toast } from 'react-toastify';

interface InviteMemberProps {
  workspaceId: string;
  onSuccess?: () => void;
}

export function InviteMember({ workspaceId, onSuccess }: InviteMemberProps) {
  const { inviteMember } = useWorkspace();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }

    setIsLoading(true);

    try {
      await inviteMember(workspaceId, email);
      toast.success('Invitation sent!');
      setEmail('');
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invitation';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-bolt-elements-item-backgroundDanger border border-bolt-elements-borderColor">
          <p className="text-sm text-bolt-elements-item-contentDanger">{error}</p>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send Invitation'}
      </Button>
    </form>
  );
}

import { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Label } from '~/components/ui/Label';
import { useAuth } from '~/lib/hooks/useAuth';
import { toast } from 'react-toastify';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignup?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToSignup }: LoginFormProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await login(email, password);
      toast.success('Logged in successfully!');
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to log in';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-bolt-elements-textPrimary">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-bolt-elements-textPrimary">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-bolt-elements-item-backgroundDanger border border-bolt-elements-borderColor">
          <p className="text-sm text-bolt-elements-item-contentDanger">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-bolt-elements-background-depth-2 hover:bg-accent-500 text-bolt-elements-textPrimary hover:text-white font-medium py-2.5 shadow-sm transition-colors border border-bolt-elements-border hover:border-accent-500"
        disabled={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Log in'}
      </Button>

      {onSwitchToSignup && (
        <p className="text-sm text-center text-bolt-elements-textSecondary">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-gray-600 dark:text-gray-400 hover:text-accent-500 transition-colors bg-transparent border-0 p-0 cursor-pointer font-inherit"
          >
            Sign up
          </button>
        </p>
      )}
    </form>
  );
}

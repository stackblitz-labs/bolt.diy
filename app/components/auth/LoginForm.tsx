import { useState } from 'react';
import { MdEmail, MdLock } from 'react-icons/md';
import { FaGoogle, FaFacebook } from 'react-icons/fa';
import { signIn } from '~/lib/auth/auth.client';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { useNavigate } from '@remix-run/react';

interface LoginFormProps {
  onRegisterClick?: () => void;
  onSuccess?: () => void;
}

export function LoginForm({ onRegisterClick, onSuccess }: LoginFormProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message || 'Failed to login');
      } else {
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/app?login=true');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: '/app?login=true',
      });
    } catch (err) {
      console.error('Google login failed', err);
      setError('Google login failed');
    }
  };

  const handleFacebookLogin = async () => {
    try {
      await signIn.social({
        provider: 'facebook',
        callbackURL: '/app?login=true',
      });
    } catch (err) {
      console.error('Facebook login failed', err);
      setError('Facebook login failed');
    }
  };

  return (
    <div className="p-8 md:p-12">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
        <p className="text-gray-600 dark:text-gray-400">Login to access your projects</p>
      </div>

      <div className="flex flex-col gap-6">
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <MdEmail className="h-5 w-5" />
            </div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="h-12 border-gray-200 bg-white pl-10 text-base shadow-sm focus-visible:ring-black dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus-visible:ring-white"
              required
            />
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <MdLock className="h-5 w-5" />
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-12 border-gray-200 bg-white pl-10 text-base shadow-sm focus-visible:ring-black dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus-visible:ring-white"
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-xl bg-[#1a1b2e] text-base font-medium text-white hover:bg-[#2f3049] dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="h-px w-full bg-gray-200 dark:bg-gray-700"></div>
          </div>
          <div className="relative bg-white px-4 text-sm text-gray-400 dark:bg-gray-900">or</div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoogleLogin}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-base font-medium text-gray-700 shadow-sm transition-transform active:scale-[0.98] hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            <FaGoogle className="h-5 w-5" />
            <span>Continue with Google</span>
          </button>

          <button
            onClick={handleFacebookLogin}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#1877F2] text-base font-medium text-white shadow-sm transition-transform active:scale-[0.98] hover:bg-[#166fe5]"
          >
            <FaFacebook className="h-5 w-5 text-white" />
            <span>Continue with Facebook</span>
          </button>
        </div>

        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <button
            onClick={onRegisterClick}
            className="font-semibold text-black underline underline-offset-2 hover:text-gray-800 dark:text-white dark:hover:text-gray-200"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

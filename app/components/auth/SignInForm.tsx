import { useState, useEffect } from 'react';
import { getSupabase } from '~/lib/supabase/client';
import type { AuthError } from '@supabase/supabase-js';
import { GoogleIcon } from '~/components/icons/google-icon';
import { LogIn } from '~/components/ui/Icon';

interface SignInFormProps {
  onToggleForm: () => void;
  onError: (message: string) => void;
  onForgotPassword?: () => void;
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email);
};

export function SignInForm({ onToggleForm, onError, onForgotPassword }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [disabled, setDisabled] = useState(true);
  const [isEmailValid, setIsEmailValid] = useState(true);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (window.analytics && data.user) {
        window.analytics.identify(data.user.id, {
          name: data.user.user_metadata.full_name,
          email: data.user.email,
          userId: data.user.id,
          lastSignIn: new Date().toISOString(),
          signInMethod: 'email',
        });
      }
      if (window.LogRocket && data.user) {
        window.LogRocket.identify(data.user.id, {
          name: data.user.user_metadata.full_name,
          email: data.user.email,
          userId: data.user.id,
          lastSignIn: new Date().toISOString(),
          signInMethod: 'email',
        });
      }
    } catch (error) {
      const authError = error as AuthError;
      onError(authError.message || 'Failed to sign in');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsProcessing(true);

    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}&isSignup=false`,
        },
      });

      if (error) {
        throw error;
      }
      // OAuth redirect initiated - user will be redirected to Google and then back to our callback
    } catch (error) {
      const authError = error as AuthError;
      onError(authError.message || 'Failed to sign in with Google');
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const emailValid = email === '' || validateEmail(email);
    setIsEmailValid(emailValid);
    setDisabled(email === '' || password === '' || !emailValid);
  }, [email, password]);

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-lg">
          <LogIn className="text-blue-500" size={24} />
        </div>
        <h2 className="text-3xl font-bold text-bolt-elements-textHeading">Welcome Back</h2>
        <p className="text-bolt-elements-textSecondary mt-2">Sign in to continue building amazing apps</p>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isProcessing}
        className="w-full mb-6 p-4 flex items-center justify-center gap-3 bg-white text-gray-800 rounded-xl hover:bg-gray-50 disabled:opacity-50 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] group font-medium"
      >
        <GoogleIcon />
        <span className="transition-transform duration-200 group-hover:scale-105">
          {isProcessing ? 'Processing...' : 'Continue with Google'}
        </span>
      </button>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-bolt-elements-borderColor border-opacity-50"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 py-2 bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary rounded-lg border border-bolt-elements-borderColor border-opacity-30 shadow-sm">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSignIn} className="space-y-6">
        <div>
          <label htmlFor="email" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor border-opacity-50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Enter your email"
            required
          />
          {email !== '' && !isEmailValid && (
            <div className="mt-2 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              Please enter a valid email address
            </div>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor border-opacity-50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Enter your password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isProcessing || disabled}
          className="w-full py-4 !bg-gradient-to-r !from-blue-500 !to-indigo-500 hover:!from-blue-600 hover:!to-indigo-600 text-white rounded-xl disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:hover:shadow-lg disabled:hover:scale-100 border border-white/20 hover:border-white/30 disabled:opacity-60 group"
        >
          <span className="transition-transform duration-200 group-hover:scale-105">
            {isProcessing ? 'Signing In...' : 'Sign In'}
          </span>
        </button>
      </form>

      {onForgotPassword && (
        <div className="mt-6 text-center">
          <button
            onClick={onForgotPassword}
            className="text-blue-500 hover:text-blue-600 font-medium bg-transparent text-sm transition-all duration-200 hover:scale-105 px-2 py-1 rounded-lg hover:bg-blue-500/10"
          >
            Forgot password?
          </button>
        </div>
      )}

      <div className="mt-8 text-center p-4 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-xl border border-bolt-elements-borderColor border-opacity-30">
        <p className="text-bolt-elements-textSecondary">
          Don't have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-blue-500 hover:text-blue-600 font-semibold bg-transparent transition-all duration-200 hover:scale-105 px-2 py-1 rounded-lg hover:bg-blue-500/10"
          >
            Sign Up
          </button>
        </p>
      </div>
    </>
  );
}

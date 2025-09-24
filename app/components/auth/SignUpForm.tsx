import { useEffect, useState } from 'react';
import { getSupabase } from '~/lib/supabase/client';
import type { AuthError } from '@supabase/supabase-js';
import { GoogleIcon } from '~/components/icons/google-icon';

interface SignUpFormProps {
  onToggleForm: () => void;
  addIntercomUser: (userEmail: string, name: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email);
};

export function SignUpForm({ addIntercomUser, onToggleForm, onSuccess, onError }: SignUpFormProps) {
  const [disabled, setDisabled] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const [isEmailValid, setIsEmailValid] = useState(true);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsProcessing(true);

    try {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}&emailConfirm=true`,
        },
      });

      if (data.user?.email && isChecked) {
        addIntercomUser(data.user.email, data.user.user_metadata.full_name);
      }

      if (error) {
        throw error;
      }

      // Note: Analytics tracking will happen when user clicks email confirmation link
      // and lands on /auth/callback, so we don't track here to avoid duplicate events

      onSuccess("Check your email for the confirmation link! You'll be redirected back here after confirming.");
    } catch (error) {
      const authError = error as AuthError;
      onError(authError.message || 'Failed to sign up');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}&intercom=${isChecked}&isSignup=true`,
      },
    });

    if (error) {
      onError(error.message || 'Failed to sign in with Google');
      return;
    }
    // OAuth redirect initiated - user will be redirected to Google and then back to our callback
  };

  useEffect(() => {
    const emailValid = email === '' || validateEmail(email);
    setIsEmailValid(emailValid);
    setDisabled(
      password !== confirmPassword || email === '' || password === '' || confirmPassword === '' || !emailValid,
    );
  }, [password, confirmPassword, email]);

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-green-500/20 shadow-lg">
          <div className="i-ph:user-plus text-2xl text-green-500" />
        </div>
        <h2 className="text-3xl font-bold text-bolt-elements-textHeading">Create Account</h2>
        <p className="text-bolt-elements-textSecondary mt-2">Join us and start building amazing apps</p>
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
          <div className="w-full border-t border-bolt-elements-borderColor/50"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 py-2 bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary rounded-lg border border-bolt-elements-borderColor/30 shadow-sm">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSignUp} className="space-y-6">
        <div>
          <label htmlFor="name" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor/50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Enter your name"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor/50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
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
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor/50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Create a password"
            required
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor/50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Confirm your password"
            required
          />
        </div>

        {password !== '' && confirmPassword !== '' && password !== confirmPassword && (
          <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
            Passwords do not match
          </div>
        )}

        {password !== '' && password.length < 6 && (
          <div className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
            Passwords must be at least 6 characters long
          </div>
        )}

        <div className="p-4 bg-bolt-elements-background-depth-2/30 rounded-xl border border-bolt-elements-borderColor/30">
          <div className="flex items-start gap-3">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                id="terms"
                checked={isChecked}
                onChange={() => setIsChecked(!isChecked)}
                className="peer appearance-none h-5 w-5 rounded-lg border-2 border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 cursor-pointer checked:bg-green-500 checked:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200"
              />
              <svg
                className="absolute left-0 w-5 h-5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white transition-opacity duration-200"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <label className="text-bolt-elements-textSecondary cursor-pointer text-sm leading-relaxed" htmlFor="terms">
              I agree to receive update emails from Nut and understand the terms of service.
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isProcessing || disabled}
          className="w-full py-4 !bg-gradient-to-r !from-green-500 !to-emerald-500 hover:!from-green-600 hover:!to-emerald-600 text-white rounded-xl disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:hover:shadow-lg disabled:hover:scale-100 border border-white/20 hover:border-white/30 disabled:opacity-60 group"
        >
          <span className="transition-transform duration-200 group-hover:scale-105">
            {isProcessing ? 'Creating Account...' : 'Create Account'}
          </span>
        </button>
      </form>

      <div className="mt-8 text-center p-4 bg-bolt-elements-background-depth-2/30 rounded-xl border border-bolt-elements-borderColor/30">
        <p className="text-bolt-elements-textSecondary">
          Already have an account?{' '}
          <button
            onClick={onToggleForm}
            className="text-green-500 hover:text-green-600 font-semibold bg-transparent transition-all duration-200 hover:scale-105 px-2 py-1 rounded-lg hover:bg-green-500/10"
          >
            Sign In
          </button>
        </p>
      </div>
    </>
  );
}

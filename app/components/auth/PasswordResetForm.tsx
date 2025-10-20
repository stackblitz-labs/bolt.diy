import { useState, useEffect } from 'react';
import { getSupabase } from '~/lib/supabase/client';
import type { AuthError } from '@supabase/supabase-js';
import { Key } from '~/components/ui/Icon';

interface PasswordResetFormProps {
  onBack: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email);
};

export function PasswordResetForm({ onBack, onSuccess, onError }: PasswordResetFormProps) {
  const [email, setEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [disabled, setDisabled] = useState(true);
  const [isEmailValid, setIsEmailValid] = useState(true);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const redirectUrl = 'https://nut.new/reset-password';

      const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        throw error;
      }

      onSuccess('Password reset link sent! Check your email for instructions.');
    } catch (error) {
      const authError = error as AuthError;
      onError(authError.message || 'Failed to send password reset email');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const emailValid = email === '' || validateEmail(email);
    setIsEmailValid(emailValid);
    setDisabled(email === '' || !emailValid);
  }, [email]);

  return (
    <>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/20 shadow-lg">
          <Key className="text-orange-500" size={24} />
        </div>
        <h2 className="text-3xl font-bold text-bolt-elements-textHeading">Reset Your Password</h2>
        <p className="text-bolt-elements-textSecondary mt-2 leading-relaxed">
          Enter your email address and we'll send you a secure link to reset your password.
        </p>
      </div>

      <form onSubmit={handlePasswordReset} className="space-y-6">
        <div>
          <label htmlFor="reset-email" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
            Email Address
          </label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor border-opacity-50 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Enter your email address"
            required
          />
          {email !== '' && !isEmailValid && (
            <div className="mt-2 text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              Please enter a valid email address
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isProcessing || disabled}
          className="w-full py-4 !bg-gradient-to-r !from-orange-500 !to-amber-500 hover:!from-orange-600 hover:!to-amber-600 text-white rounded-xl disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:hover:shadow-lg disabled:hover:scale-100 border border-white/20 hover:border-white/30 disabled:opacity-60 group"
        >
          <span className="transition-transform duration-200 group-hover:scale-105">
            {isProcessing ? 'Sending Reset Link...' : 'Send Reset Link'}
          </span>
        </button>
      </form>

      <div className="mt-8 text-center p-4 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-xl border border-bolt-elements-borderColor border-opacity-30">
        <p className="text-bolt-elements-textSecondary">
          Remember your password?{' '}
          <button
            onClick={onBack}
            className="text-orange-500 hover:text-orange-600 font-semibold bg-transparent transition-all duration-200 hover:scale-105 px-2 py-1 rounded-lg hover:bg-orange-500/10"
          >
            Sign In
          </button>
        </p>
      </div>
    </>
  );
}

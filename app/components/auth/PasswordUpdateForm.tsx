import { useState, useEffect } from 'react';
import { getSupabase } from '~/lib/supabase/client';
import type { AuthError } from '@supabase/supabase-js';
import { Lock } from '~/components/ui/Icon';

interface PasswordUpdateFormProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function PasswordUpdateForm({ onSuccess, onError }: PasswordUpdateFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [disabled, setDisabled] = useState(true);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      onError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      onError('Password must be at least 6 characters long');
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await getSupabase().auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      onSuccess('Password updated successfully! You are now signed in.');
    } catch (error) {
      const authError = error as AuthError;
      onError(authError.message || 'Failed to update password');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    setDisabled(password === '' || confirmPassword === '' || password.length < 6 || password !== confirmPassword);
  }, [password, confirmPassword]);

  return (
    <>
      <div className="text-center mb-8">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-2xl flex items-center justify-center shadow-lg mb-6 border border-green-500/20">
          <Lock className="text-green-500" size={30} />
        </div>
        <h2 className="text-3xl font-bold mb-4 text-bolt-elements-textHeading">Set New Password</h2>
        <p className="text-bolt-elements-textSecondary text-lg bg-bolt-elements-background-depth-2 bg-opacity-30 px-4 py-2 rounded-xl inline-block border border-bolt-elements-borderColor border-opacity-30">
          Please enter your new password below.
        </p>
      </div>

      <form onSubmit={handlePasswordUpdate} className="space-y-6">
        <div>
          <label htmlFor="new-password" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor border-opacity-50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Enter your new password"
            required
          />
        </div>

        <div>
          <label
            htmlFor="confirm-new-password"
            className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary"
          >
            Confirm New Password
          </label>
          <input
            id="confirm-new-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-4 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor border-opacity-50 focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
            placeholder="Confirm your new password"
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
            Password must be at least 6 characters long
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing || disabled}
          className="w-full py-4 !bg-gradient-to-r !from-green-500 !to-emerald-500 hover:!from-green-600 hover:!to-emerald-600 text-white rounded-xl disabled:cursor-not-allowed font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:hover:shadow-lg disabled:hover:scale-100 border border-white/20 hover:border-white/30 disabled:opacity-60 group"
        >
          <span className="transition-transform duration-200 group-hover:scale-105">
            {isProcessing ? 'Updating Password...' : 'Update Password'}
          </span>
        </button>
      </form>
    </>
  );
}

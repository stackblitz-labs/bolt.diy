import React, { useEffect } from 'react';
import { authModalStore } from '~/lib/stores/authModal';

interface SignInCardProps {
  onMount?: () => void;
}

export const SignInCard: React.FC<SignInCardProps> = ({ onMount }) => {
  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  const handleSignInClick = () => {
    authModalStore.open(false);
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-teal-500/5 border border-green-500/20 rounded-2xl p-6 transition-all duration-300 hover:border-green-500/30 hover:shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-full shadow-lg">
            <div className="i-ph:user-plus text-2xl"></div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Sign In to Continue Building</h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              To start building and deploying your application, you'll need to sign in or create an account. After sign
              up, you will receive 1000 free peanuts (credits) to use for building your app.
            </p>
          </div>

          <button
            onClick={handleSignInClick}
            className="flex items-center gap-3 px-6 py-3 !bg-gradient-to-r !from-green-500 !to-emerald-500 hover:!from-green-600 hover:!to-emerald-600 text-white text-base font-semibold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group"
          >
            <div className="i-ph:sign-in text-lg transition-transform duration-200 group-hover:scale-110"></div>
            <span className="transition-transform duration-200 group-hover:scale-105">Sign In to Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
};

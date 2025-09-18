import React, { useEffect } from 'react';
import { doAbortChat } from '~/lib/stores/chat';

interface StopBuildCardProps {
  onMount?: () => void;
}

export const StopBuildCard: React.FC<StopBuildCardProps> = ({ onMount }) => {
  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  const handleStopBuild = (event: React.MouseEvent) => {
    event.preventDefault();
    doAbortChat();
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-red-500/10 via-red-600/8 to-red-700/6 border border-red-500/30 rounded-2xl p-6 transition-all duration-300 hover:border-red-500/40 hover:shadow-lg shadow-md bg-bolt-elements-background-depth-1 relative overflow-hidden">
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-red-500/20 to-transparent animate-flow-left-to-right" />
        </div>

        <div className="flex flex-col items-center text-center space-y-4 relative">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Build in Progress</h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              Your app is currently being built. Click the button below to stop the build process if desired.
            </p>
          </div>

          <button
            onClick={handleStopBuild}
            className="px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-2 min-h-[48px] !bg-gradient-to-r !from-red-600 !to-rose-600 hover:!from-red-700 hover:!to-rose-700"
          >
            <div className="i-ph:stop-circle-bold text-lg transition-transform duration-200 group-hover:scale-110"></div>
            <span className="transition-transform duration-200 group-hover:scale-105">Stop Build</span>
          </button>
        </div>
      </div>
    </div>
  );
};

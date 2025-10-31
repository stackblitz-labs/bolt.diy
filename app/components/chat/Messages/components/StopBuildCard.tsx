import React, { useEffect, useState } from 'react';
import { doAbortChat } from '~/lib/stores/chat';
import { StopCircle } from '~/components/ui/Icon';

interface StopBuildCardProps {
  onMount?: () => void;
}

export const StopBuildCard: React.FC<StopBuildCardProps> = ({ onMount }) => {
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  const handleStopBuildClick = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowConfirmation(true);
  };

  const handleConfirmStop = (event: React.MouseEvent) => {
    event.preventDefault();
    doAbortChat();
  };

  const handleCancelStop = (event: React.MouseEvent) => {
    event.preventDefault();
    setShowConfirmation(false);
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-red-500/10 via-red-600/8 to-red-700/6 border border-red-500/30 rounded-2xl p-6 transition-all duration-300 hover:border-red-500/40 hover:shadow-lg shadow-md bg-bolt-elements-background-depth-1 relative overflow-hidden">
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-red-500/20 to-transparent animate-flow-left-to-right" />
        </div>

        <div className="flex flex-col items-center text-center space-y-4 relative">
          {!showConfirmation ? (
            <>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Build in Progress</h3>
                <p className="text-bolt-elements-textSecondary text-sm max-w-md">
                  Your app is currently being built. Click the button below to stop the build process if desired.
                </p>
              </div>

              <button
                onClick={handleStopBuildClick}
                className="px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-2 min-h-[48px] !bg-gradient-to-r !from-red-600 !to-rose-600 hover:!from-red-700 hover:!to-rose-700"
              >
                <StopCircle
                  className="transition-transform duration-200 group-hover:scale-110"
                  size={18}
                  strokeWidth={2.5}
                />
                <span className="transition-transform duration-200 group-hover:scale-105">Stop Build</span>
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Confirm Stop Build?</h3>
                <p className="text-bolt-elements-textSecondary text-sm max-w-md">
                  Are you sure you want to stop the build process? This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirmStop}
                  className="px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-2 min-h-[48px] !bg-gradient-to-r !from-green-600 !to-emerald-600 hover:!from-green-700 hover:!to-emerald-700"
                >
                  <span className="transition-transform duration-200 group-hover:scale-105">Yes</span>
                </button>

                <button
                  onClick={handleCancelStop}
                  className="px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group flex items-center justify-center gap-2 min-h-[48px] !bg-gradient-to-r !from-red-600 !to-rose-600 hover:!from-red-700 hover:!to-rose-700"
                >
                  <span className="transition-transform duration-200 group-hover:scale-105">No</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

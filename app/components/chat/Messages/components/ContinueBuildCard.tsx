import React, { useEffect } from 'react';
import { StartBuildingButton } from '~/components/chat/StartBuildingButton';
import { ChatMode } from '~/lib/replay/SendChatMessage';

interface ContinueBuildCardProps {
  sendMessage?: (params: { messageInput: string; chatMode: ChatMode }) => void;
  onMount?: () => void;
}

export const ContinueBuildCard: React.FC<ContinueBuildCardProps> = ({ sendMessage, onMount }) => {
  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  const handleContinueBuilding = () => {
    if (sendMessage) {
      sendMessage({
        messageInput: 'Continue building the app based on these requirements.',
        chatMode: ChatMode.DevelopApp,
      });
    }
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-teal-500/5 border border-green-500/20 rounded-2xl p-6 transition-all duration-300 hover:border-green-500/30 hover:shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-full shadow-lg">
            <div className="i-ph:rocket-launch text-2xl"></div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Continue Building</h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              Ready to continue working on your app? Click the button below to keep building where you left off.
            </p>
          </div>

          <div className="relative">
            <StartBuildingButton onClick={handleContinueBuilding} buttonText="Continue Building" />
          </div>
        </div>
      </div>
    </div>
  );
};

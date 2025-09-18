import React, { useEffect } from 'react';
import { StartBuildingButton } from '~/components/chat/StartBuildingButton';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { workbenchStore } from '~/lib/stores/workbench';
import { mobileNavStore } from '~/lib/stores/mobileNav';

interface StartBuildingCardProps {
  startPlanningRating: number;
  sendMessage?: (params: { messageInput: string; chatMode: ChatMode }) => void;
  onMount?: () => void;
}

export const StartBuildingCard: React.FC<StartBuildingCardProps> = ({ startPlanningRating, sendMessage, onMount }) => {
  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-500/20 rounded-2xl p-6 transition-all duration-300 hover:border-blue-500/30 hover:shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-full shadow-lg">
            <div className="i-ph:rocket-launch text-2xl"></div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Ready to Start Building!</h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              I have all the information I need to start building your app. Click the button below to begin the
              development process!
            </p>
          </div>

          <div className="relative">
            <StartBuildingButton
              onClick={() => {
                if (sendMessage) {
                  const message = 'Start building the app based on these requirements.';
                  sendMessage({ messageInput: message, chatMode: ChatMode.DevelopApp });
                  setTimeout(() => {
                    workbenchStore.setShowWorkbench(true);
                    mobileNavStore.setShowMobileNav(true);
                    mobileNavStore.setActiveTab('preview');
                  }, 2000);
                }
              }}
              startPlanningRating={startPlanningRating}
              buttonText="Start Building Now!"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

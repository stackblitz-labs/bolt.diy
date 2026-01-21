import React, { useEffect } from 'react';
import { StartBuildingButton } from '~/components/chat/StartBuildingButton';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { workbenchStore } from '~/lib/stores/workbench';
import { mobileNavStore } from '~/lib/stores/mobileNav';
import { useStore } from '@nanostores/react';
import { userStore } from '~/lib/stores/auth';
import { Rocket } from '~/components/ui/Icon';

interface StartBuildingCardProps {
  startPlanningRating: number;
  sendMessage?: (params: ChatMessageParams) => void;
  onMount?: () => void;
}

export const StartBuildingCard: React.FC<StartBuildingCardProps> = ({ startPlanningRating, sendMessage, onMount }) => {
  const user = useStore(userStore);
  useEffect(() => {
    if (onMount) {
      onMount();
    }
  }, []);

  const handleStartBuilding = () => {
    if (sendMessage) {
      const message = 'Start building the app based on these requirements.';

      sendMessage({ messageInput: message, chatMode: ChatMode.DevelopApp });

      if (window.analytics) {
        window.analytics.track('Clicked Start Building button', {
          timestamp: new Date().toISOString(),
          userId: user?.id,
          email: user?.email,
        });
      }

      setTimeout(() => {
        workbenchStore.setShowWorkbench(true);
        mobileNavStore.setShowMobileNav(true);
        mobileNavStore.setActiveTab('canvas');
      }, 2000);
    }
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-500/20 rounded-2xl p-6 transition-all duration-300 hover:border-blue-500/30 hover:shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-full shadow-lg">
            <Rocket className="text-white" size={24} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">Ready to Create Your App?</h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              I have all the information I need to start generating your app.
            </p>
          </div>

          <div className="relative">
            <StartBuildingButton
              onClick={handleStartBuilding}
              startPlanningRating={startPlanningRating}
              buttonText="Start Building!"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

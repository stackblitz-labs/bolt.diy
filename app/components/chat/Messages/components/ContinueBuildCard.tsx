import React, { useEffect } from 'react';
import { StartBuildingButton } from '~/components/chat/StartBuildingButton';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import type { ChatMessageParams } from '~/components/chat/ChatComponent/components/ChatImplementer/ChatImplementer';
import { Rocket } from '~/components/ui/Icon';

interface ContinueBuildCardProps {
  sendMessage?: (params: ChatMessageParams) => void;
  setShowContinueBuildCard?: (show: boolean) => void;
  onMount?: () => void;
  unpaidFeatureCost?: number;
}

export const ContinueBuildCard: React.FC<ContinueBuildCardProps> = ({
  sendMessage,
  onMount,
  setShowContinueBuildCard,
  unpaidFeatureCost,
}) => {
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
        payFeatures: true,
      });

      if (setShowContinueBuildCard) {
        setShowContinueBuildCard(false);
      }
    }
  };

  return (
    <div className="w-full mt-5">
      <div className="bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-teal-500/5 border border-green-500/20 rounded-2xl p-6 transition-all duration-300 hover:border-green-500/30 hover:shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-full shadow-lg">
            <Rocket className="text-white" size={24} />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-bolt-elements-textHeading">
              {unpaidFeatureCost ? "Continue Building Your App's Features?" : 'Continue Building Your App!'}
            </h3>
            <p className="text-bolt-elements-textSecondary text-sm max-w-md">
              {unpaidFeatureCost ? (
                <>
                  <b>Build Cost: {unpaidFeatureCost} peanuts</b>
                  <br />
                  To continue building your app's features, we'll deduct the peanuts from your account.
                </>
              ) : (
                'Ready to continue building your app? Click the button below to pick up where you left off.'
              )}
            </p>
          </div>

          <div className="relative">
            <StartBuildingButton
              onClick={handleContinueBuilding}
              buttonText="Continue Building!"
              tooltip={unpaidFeatureCost ? "Build Your App's Features!" : 'Continue Building Your App!'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

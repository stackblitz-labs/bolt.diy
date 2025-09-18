import { AppFeatureStatus, type AppSummary } from '~/lib/persistence/messageAppSummary';
import Pages from './components/Pages';
import Secrets from './components/Secrets';
import Features from './components/Features/Features';
import { useStore } from '@nanostores/react';
import { chatStore, doAbortChat, doSendMessage } from '~/lib/stores/chat';
import { ChatMode } from '~/lib/replay/SendChatMessage';
import { peanutsStore } from '~/lib/stores/peanuts';
import WithTooltip from '~/components/ui/Tooltip';
import { assert } from '~/utils/nut';
import AuthSelector from './components/AuthSelector';
import { TooltipProvider } from '@radix-ui/react-tooltip';

function appSummaryHasPendingFeature(appSummary: AppSummary | undefined) {
  return (
    appSummary?.features?.length &&
    appSummary.features.some(
      (feature) => feature.status != AppFeatureStatus.Validated && feature.status != AppFeatureStatus.ValidationFailed,
    )
  );
}

const PlanView = () => {
  const appId = useStore(chatStore.currentAppId);
  const listenResponses = useStore(chatStore.listenResponses);
  const appSummary = useStore(chatStore.appSummary);

  const completedFeatures = appSummary?.features?.filter(
    (feature) => feature.status === AppFeatureStatus.Validated,
  ).length;
  const totalFeatures = appSummary?.features?.length;
  const isFullyComplete = completedFeatures === totalFeatures && totalFeatures && totalFeatures > 0;
  const peanutsErrorButton = useStore(peanutsStore.peanutsErrorButton);
  const peanutsErrorInfo = useStore(peanutsStore.peanutsErrorInfo);
  const hasSecrets = appSummary?.features?.some((f) => f.secrets?.length);
  const dividerStyles: React.CSSProperties = {
    display: 'block',
    height: '1em',
    width: '100%',
    borderTop: '1px solid',
    borderColor: 'var(--bolt-elements-borderColor)',
    marginTop: '1em',
  };
  const pullLeft: React.CSSProperties = { textAlign: 'left', display: 'inline-block', width: '50%' };
  const pullRight: React.CSSProperties = { textAlign: 'right', display: 'inline-block', width: '49%' };
  return (
    <div className="relative h-full w-full">
      <div className="h-full overflow-auto bg-bolt-elements-background-depth-1/50 p-6">
        <div className="max-w-4xl mx-auto min-h-full flex flex-col">
          <div>
            {!listenResponses && appSummaryHasPendingFeature(appSummary) && !isFullyComplete && (
              <div className="flex flex-col items-center">
                <TooltipProvider>
                  <WithTooltip tooltip={peanutsErrorInfo ?? 'Continue Building Your App!'}>
                    <button
                      className={`mb-6 p-4 rounded-xl transition-all duration-200 text-left cursor-pointer border ${
                        peanutsErrorButton
                          ? 'bg-gray-500 text-white shadow-md border-gray-400/30'
                          : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 border-white/20 hover:border-white/30 group'
                      }`}
                      onClick={(event) => {
                        event.preventDefault();
                        assert(appId, 'No app id');
                        doSendMessage({ appId, mode: ChatMode.DevelopApp });
                      }}
                      disabled={!!peanutsErrorButton}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`i-ph:rocket-launch text-xl text-white transition-transform duration-200 ${
                            peanutsErrorButton ? '' : 'group-hover:scale-110'
                          }`}
                        ></div>
                        <div
                          className={`font-medium text-white transition-transform duration-200 ${
                            peanutsErrorButton ? '' : 'group-hover:scale-105'
                          }`}
                        >
                          {peanutsErrorButton ?? 'Continue Building'}
                        </div>
                      </div>
                    </button>
                  </WithTooltip>
                </TooltipProvider>
                {peanutsErrorInfo && (
                  <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-md text-center">
                    {peanutsErrorInfo}
                  </div>
                )}
              </div>
            )}
            {listenResponses && appSummary?.features?.length && !isFullyComplete && (
              <div className="flex justify-center items-center">
                <button
                  className="mb-6 p-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl transition-all duration-200 text-left cursor-pointer shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group"
                  onClick={(event) => {
                    event.preventDefault();
                    doAbortChat();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="i-ph:stop-circle-bold text-xl text-white transition-transform duration-200 group-hover:scale-110"></div>
                    <div className="font-medium text-white transition-transform duration-200 group-hover:scale-105">
                      Build in Progress (Click to Stop)
                    </div>
                  </div>
                </button>
              </div>
            )}
            <div className="mb-8 p-4 bg-bolt-elements-background-depth-2/50 rounded-xl border border-bolt-elements-borderColor/50">
              <div className="text-lg font-semibold mb-3 text-bolt-elements-textHeading">Project Description</div>
              <div className="text-bolt-elements-textSecondary leading-relaxed">{appSummary?.description}</div>
              {appSummary?.features && appSummary.features.length > 0 && (
                <div className="mb-4">
                  <div style={dividerStyles} />
                  <div className="mb-1 text-sm text-bolt-elements-textSecondary">
                    <b style={pullLeft}>PROGRESS:</b>{' '}
                    <span style={pullRight}>
                      {completedFeatures} / {appSummary.features.length} features complete
                    </span>
                  </div>
                  <div className="w-full h-3 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                      style={{
                        width: `${((completedFeatures ?? 0) / appSummary.features.length) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            {<AuthSelector />}
            {hasSecrets && <Secrets />}
            {appSummary?.pages && <Pages />}
          </div>
          {(appSummary?.features || appSummary?.mockupStatus) && (
            <div>
              <Features />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlanView;

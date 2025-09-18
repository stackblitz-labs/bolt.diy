import React from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { type AppSummary, type AppFeature, AppFeatureStatus } from '~/lib/persistence/messageAppSummary';
import Features from '~/components/workbench/Preview/components/PlanView/components/Features/Features';
import Events from '~/components/workbench/Preview/components/PlanView/components/Features/components/Events';
import Pages from '~/components/workbench/Preview/components/PlanView/components/Pages';
import Secrets from '~/components/workbench/Preview/components/PlanView/components/Secrets';
import AuthSelector from '~/components/workbench/Preview/components/PlanView/components/AuthSelector';

type ModalType = 'project-description' | 'features' | 'mockup' | 'secrets' | 'auth';

interface AppCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ModalType;
  appSummary: AppSummary;
  feature?: AppFeature;
}

export const AppCardModal: React.FC<AppCardModalProps> = ({ isOpen, onClose, type, appSummary }) => {
  const features = appSummary.features?.slice(1) || [];
  const completedFeatures = features.filter(
    (f) =>
      f.status === AppFeatureStatus.Validated ||
      f.status === AppFeatureStatus.Implemented ||
      f.status === AppFeatureStatus.ValidationInProgress ||
      f.status === AppFeatureStatus.ValidationFailed,
  ).length;
  const totalFeatures = features.length;

  const getModalTitle = () => {
    switch (type) {
      case 'project-description':
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <div className="i-ph:info-duotone text-white text-lg" />
            </div>
            Project Overview
          </div>
        );
      case 'features':
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm">
              <div className="i-ph:puzzle-piece-duotone text-white text-lg" />
            </div>
            Features
          </div>
        );
      case 'mockup':
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <div className="i-ph:hammer text-white text-lg" />
            </div>
            Mockup Details
          </div>
        );

      case 'secrets':
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
              <div className="i-ph:key-duotone text-white text-lg" />
            </div>
            Secrets Configuration
          </div>
        );
      case 'auth':
        return (
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <div className="i-ph:shield-check-duotone text-white text-lg" />
            </div>
            Authentication Settings
          </div>
        );
      default:
        return 'Details';
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'features':
        return (
          <>
            <div className="space-y-6 mb-6">
              <div className="p-6 bg-bolt-elements-background-depth-2/50 rounded-xl border border-bolt-elements-borderColor/50">
                <div className="text-lg font-semibold mb-3 text-bolt-elements-textHeading">Project Description</div>
                <div className="text-bolt-elements-textSecondary leading-relaxed">{appSummary.description}</div>

                {appSummary.features && appSummary.features.length > 0 && (
                  <div className="mt-6">
                    <div className="flex justify-between text-sm text-bolt-elements-textSecondary mb-2">
                      <span>
                        <b>PROGRESS:</b>
                      </span>
                      <span>
                        {completedFeatures} / {totalFeatures} features complete
                      </span>
                    </div>
                    <div className="w-full h-3 bg-bolt-elements-background-depth-3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                        style={{
                          width: `${(completedFeatures / totalFeatures) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Features />
          </>
        );

      case 'mockup':
        return (
          <div className="space-y-6">
            <Pages />
            <Events featureName={undefined} />
          </div>
        );

      case 'secrets':
        return <Secrets />;

      case 'auth':
        return <AuthSelector />;

      default:
        return <div className="p-6 text-center text-bolt-elements-textSecondary">No details available</div>;
    }
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog onClose={onClose} className="max-w-4xl">
        <DialogTitle>{getModalTitle()}</DialogTitle>
        <TooltipProvider>
          <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 pt-6 pb-8">
            <div className="mb-4">{renderContent()}</div>
          </div>
        </TooltipProvider>
      </Dialog>
    </DialogRoot>
  );
};

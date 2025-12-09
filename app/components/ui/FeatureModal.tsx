import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Icon, CreditCard, Hourglass } from '~/components/ui/Icon';
import { Loader2 } from 'lucide-react';
import { CheckCircle } from 'lucide-react';
import { AppFeatureKind, AppFeatureStatus } from '~/lib/persistence/messageAppSummary';
import { XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { formatPascalCaseName } from '~/utils/names';
import { chatStore } from '~/lib/stores/chat';
import { featureModalStore, closeFeatureModal } from '~/lib/stores/featureModal';
import Tests from '~/components/workbench/Preview/components/PlanView/components/Features/components/Tests';
import DefinedApis from '~/components/workbench/Preview/components/PlanView/components/Features/components/DefinedApis';
import DatabaseChanges from '~/components/workbench/Preview/components/PlanView/components/Features/components/DatabaseChanges';
import Components from '~/components/workbench/Preview/components/PlanView/components/Features/components/Components';
import Events from '~/components/workbench/Preview/components/PlanView/components/Features/components/Events';
import Pages from '~/components/workbench/Preview/components/PlanView/components/Pages';
import type { AppFeature } from '~/lib/persistence/messageAppSummary';
import FeatureDebugControls from '~/components/ui/FeatureDebugControls';
import WithTooltip from './Tooltip';
import { TooltipProvider } from '@radix-ui/react-tooltip';

interface IntegrationTestsModalContentProps {
  integrationTests: AppFeature[];
  expandedTests: Set<string>;
  setExpandedTests: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const IntegrationTestsModalContent: React.FC<IntegrationTestsModalContentProps> = ({
  integrationTests,
  expandedTests,
  setExpandedTests,
}) => {
  const appSummary = useStore(chatStore.appSummary);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeFeatureModal();
    }
  };

  const toggleTest = (testName: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testName)) {
        next.delete(testName);
      } else {
        next.add(testName);
      }
      return next;
    });
  };

  const renderFeatureStatus = (status: AppFeatureStatus) => {
    const getStatusConfig = (status: AppFeatureStatus) => {
      switch (status) {
        case AppFeatureStatus.PaymentNeeded:
          return {
            icon: CreditCard,
            label: 'Payment Required',
            className: 'text-bolt-elements-textPrimary border-amber-200',
            iconClassName: 'text-bolt-elements-textPrimary',
          };
        case AppFeatureStatus.NotStarted:
          return {
            icon: Hourglass,
            label: 'Pending',
            className: 'text-bolt-elements-textPrimary border-gray-200',
            iconClassName: 'text-bolt-elements-textPrimary',
          };
        case AppFeatureStatus.ImplementationInProgress:
          return {
            icon: Loader2,
            label: 'In Progress',
            className: 'text-blue-600 bg-blue-50 border-blue-200',
            iconClassName: 'text-blue-500',
            showSpinner: true,
          };
        case AppFeatureStatus.Implemented:
          return {
            icon: CheckCircle,
            label: 'Complete',
            className: 'text-green-600 bg-green-50 border-green-200',
            iconClassName: 'text-green-500',
          };
        case AppFeatureStatus.Failed:
          return {
            icon: XCircle,
            label: 'Failed',
            className: 'text-red-600 border-red-200',
            iconClassName: 'text-red-500',
          };
        default:
          return null;
      }
    };

    const config = getStatusConfig(status);
    if (!config) {
      return null;
    }

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border font-medium text-sm transition-all duration-200 bg-bolt-elements-background-depth-2 ${config.className}`}
      >
        {config.showSpinner ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            <span>{config.label}</span>
          </div>
        ) : (
          <>
            <Icon icon={config.icon} size={16} className={config.iconClassName} />
            <span>{config.label}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl mx-4 max-h-[90vh] bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-bolt-elements-textHeading">Integration Tests</h2>
                <p className="text-bolt-elements-textSecondary mt-1">
                  {integrationTests.length} test{integrationTests.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={closeFeatureModal}
              className="p-2 rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="space-y-3">
              {integrationTests.map((test) => {
                const isExpanded = expandedTests.has(test.name);
                const testName = formatPascalCaseName(test.name);

                return (
                  <div
                    key={test.name}
                    className="border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2 overflow-hidden"
                  >
                    {/* Test Header - Collapsible */}
                    <button
                      onClick={() => toggleTest(test.name)}
                      className="w-full flex items-center justify-between p-4 hover:bg-bolt-elements-background-depth-3 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown size={20} className="text-bolt-elements-textSecondary" />
                          ) : (
                            <ChevronRight size={20} className="text-bolt-elements-textSecondary" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-semibold text-bolt-elements-textHeading">{testName}</h3>
                          {test.description && (
                            <p className="text-sm text-bolt-elements-textSecondary mt-1">{test.description}</p>
                          )}
                        </div>
                        <div className="flex-shrink-0">{renderFeatureStatus(test.status)}</div>
                      </div>
                    </button>

                    {/* Test Details - Expandable */}
                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
                        <div className="space-y-6 mt-4">
                          {test.databaseChange &&
                            test.databaseChange.tables &&
                            test.databaseChange.tables.length > 0 && <DatabaseChanges feature={test} />}

                          {test.componentNames && test.componentNames.length > 0 && appSummary && (
                            <Components summary={appSummary} feature={test} />
                          )}

                          {test.definedAPIs && test.definedAPIs.length > 0 && <DefinedApis feature={test} />}

                          {test.tests && test.tests.length > 0 && (
                            <Tests
                              status={test.status}
                              featureTests={
                                test.status === AppFeatureStatus.Implemented
                                  ? test.tests.filter((t) => t.status)
                                  : test.tests
                              }
                            />
                          )}

                          <Events featureName={test.name} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const FeatureModal: React.FC = () => {
  const modalState = useStore(featureModalStore);
  const appSummary = useStore(chatStore.appSummary);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  if (!modalState.isOpen || !appSummary?.features) {
    return null;
  }

  // Helper to check if an IntegrationTests feature has valid test results
  // Filter out features that are "Implemented" but have no test statuses defined
  const hasValidTestResults = (feature: AppFeature): boolean => {
    if (feature.kind !== AppFeatureKind.IntegrationTests) {
      return true;
    }
    // If the feature is Implemented but all tests have no status, filter it out
    if (feature.status === AppFeatureStatus.Implemented) {
      const hasAnyTestStatus = feature.tests?.some((test) => test.status !== undefined);
      return hasAnyTestStatus === true;
    }
    return true;
  };

  // If showing IntegrationTests group
  if (modalState.isIntegrationTestsGroup) {
    const integrationTests = appSummary.features.filter((feature) => {
      if (feature.kind !== AppFeatureKind.IntegrationTests) {
        return false;
      }

      // Filter out features without valid test results
      if (!hasValidTestResults(feature)) {
        return false;
      }

      // Filter based on the filter type
      if (modalState.integrationTestsFilter === 'in-progress') {
        return (
          feature.status === AppFeatureStatus.ImplementationInProgress || feature.status === AppFeatureStatus.NotStarted
        );
      } else if (modalState.integrationTestsFilter === 'completed') {
        return feature.status === AppFeatureStatus.Implemented || feature.status === AppFeatureStatus.Failed;
      }

      return true;
    });

    return (
      <IntegrationTestsModalContent
        integrationTests={integrationTests}
        expandedTests={expandedTests}
        setExpandedTests={setExpandedTests}
      />
    );
  }

  // Filter features to match the same filtering logic used in BaseChat
  const filteredFeatures = appSummary.features.filter((feature) => feature.kind !== AppFeatureKind.DesignAPIs);
  const currentFeature = filteredFeatures[modalState.currentFeatureIndex];

  const renderFeatureStatus = (status: AppFeatureStatus) => {
    const getStatusConfig = (status: AppFeatureStatus) => {
      switch (status) {
        case AppFeatureStatus.PaymentNeeded:
          return {
            icon: CreditCard,
            label: 'Payment Required',
            className: 'text-bolt-elements-textPrimary border-amber-200',
            iconClassName: 'text-bolt-elements-textPrimary',
          };
        case AppFeatureStatus.NotStarted:
          return {
            icon: Hourglass,
            label: 'Pending',
            className: 'text-bolt-elements-textPrimary border-gray-200',
            iconClassName: 'text-bolt-elements-textPrimary',
          };
        case AppFeatureStatus.ImplementationInProgress:
          return {
            icon: Loader2,
            label: 'In Progress',
            className: 'text-blue-600 bg-blue-50 border-blue-200',
            iconClassName: 'text-blue-500',
            showSpinner: true,
          };
        case AppFeatureStatus.Implemented:
          return {
            icon: CheckCircle,
            label: 'Complete',
            className: 'text-green-600 bg-green-50 border-green-200',
            iconClassName: 'text-green-500',
          };
        case AppFeatureStatus.Failed:
          return {
            icon: XCircle,
            label: 'Failed',
            className: 'text-red-600 border-red-200',
            iconClassName: 'text-red-500',
          };
        default:
          return null;
      }
    };

    const config = getStatusConfig(status);
    if (!config) {
      return null;
    }

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border font-medium text-sm transition-all duration-200 bg-bolt-elements-background-depth-2 ${config.className}`}
      >
        {config.showSpinner ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            <span>{config.label}</span>
          </div>
        ) : (
          <>
            <Icon icon={config.icon} size={16} className={config.iconClassName} />
            <span>{config.label}</span>
          </>
        )}
      </div>
    );
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeFeatureModal();
    }
  };

  if (!currentFeature) {
    return null;
  }

  const name = formatPascalCaseName(currentFeature.name);
  const description = currentFeature.description;
  const status = currentFeature.status;

  return (
    <AnimatePresence>
      <TooltipProvider>
        {modalState.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={handleBackdropClick}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl mx-4 max-h-[90vh] bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-2">
                <div className="flex items-center gap-4 flex-1">
                  {/* Feature Info */}
                  <div className="flex-1 pr-4">
                    <h2 className="flex items-center gap-4 text-xl font-bold text-bolt-elements-textHeading">
                      {name}
                      <div className="flex-shrink-0">{renderFeatureStatus(status)}</div>

                      <FeatureDebugControls featureName={currentFeature.name} />
                    </h2>
                    {description && (
                      <WithTooltip tooltip={description} maxWidth={400}>
                        <p className="text-bolt-elements-textSecondary mt-1 line-clamp-2">{description}</p>
                      </WithTooltip>
                    )}
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={closeFeatureModal}
                  className="p-2 rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>

              {/* Content with Navigation */}
              <div className="flex items-center">
                {/* Content */}
                <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-120px)] ">
                  <div className="space-y-6">
                    {currentFeature.kind === AppFeatureKind.BuildInitialApp && <Pages />}

                    {currentFeature.databaseChange &&
                      currentFeature.databaseChange.tables &&
                      currentFeature.databaseChange.tables.length > 0 && <DatabaseChanges feature={currentFeature} />}

                    {currentFeature.componentNames && currentFeature.componentNames.length > 0 && (
                      <Components summary={appSummary} feature={currentFeature} />
                    )}

                    {currentFeature.definedAPIs && currentFeature.definedAPIs.length > 0 && (
                      <DefinedApis feature={currentFeature} />
                    )}

                    {currentFeature.tests && currentFeature.tests.length > 0 && (
                      <Tests
                        status={currentFeature.status}
                        featureTests={
                          currentFeature.kind === AppFeatureKind.IntegrationTests &&
                          currentFeature.status === AppFeatureStatus.Implemented
                            ? currentFeature.tests.filter((test) => test.status)
                            : currentFeature.tests
                        }
                      />
                    )}

                    <Events featureName={currentFeature.name} />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </TooltipProvider>
    </AnimatePresence>
  );
};

export default FeatureModal;

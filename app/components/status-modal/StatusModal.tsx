import React from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { statusModalStore } from '~/lib/stores/statusModal';
import { classNames } from '~/utils/classNames';
import { AppFeatureStatus, type AppSummary } from '~/lib/persistence/messageAppSummary';
import { peanutsStore } from '~/lib/stores/peanuts';
import WithTooltip from '~/components/ui/Tooltip';

interface StatusModalProps {
  appSummary: AppSummary;
  onContinueBuilding: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({ appSummary, onContinueBuilding }) => {
  const isOpen = useStore(statusModalStore.isOpen);
  const peanutsErrorButton = useStore(peanutsStore.peanutsErrorButton);
  const peanutsErrorInfo = useStore(peanutsStore.peanutsErrorInfo);

  const features = appSummary.features || [];
  const completedFeatures = features.filter(({ status }) => status === AppFeatureStatus.Validated).length;
  const totalFeatures = features.length;
  const isFullyComplete = completedFeatures === totalFeatures && totalFeatures > 0;

  const handleClose = () => {
    statusModalStore.close();
  };

  const handleContinueBuilding = () => {
    statusModalStore.close();
    onContinueBuilding();
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.7,
      y: 50,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 300,
        duration: 0.5,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.7,
      y: 50,
      transition: { duration: 0.2 },
    },
  };

  const celebrationVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: [0, 1.2, 1],
      rotate: [0, 360, 0],
      transition: {
        duration: 0.8,
        times: [0, 0.6, 1],
        ease: 'easeInOut',
        delay: 0.3,
      },
    },
  };

  const progressBarVariants = {
    hidden: { width: 0 },
    visible: {
      width: `${(completedFeatures / totalFeatures) * 100}%`,
      transition: {
        duration: 1,
        ease: 'easeInOut',
        delay: 0.5,
      },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[1002] flex items-center justify-center p-2 sm:p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            className="relative bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor/50 rounded-2xl shadow-2xl hover:shadow-3xl transition-shadow duration-300 max-w-md w-full mx-2 sm:mx-4 max-h-[95vh] flex flex-col backdrop-blur-sm"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={handleClose}
                className="w-10 h-10 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group"
              >
                <div className="i-ph:x text-lg transition-transform duration-200 group-hover:scale-110" />
              </button>
            </div>

            <div className="p-6 sm:p-8 text-center overflow-y-auto flex-1 min-h-0">
              <motion.div
                className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-lg backdrop-blur-sm"
                variants={celebrationVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="text-4xl">{isFullyComplete ? '🎉' : '🚀'}</div>
              </motion.div>

              <motion.h2
                className="text-3xl font-bold text-bolt-elements-textHeading mb-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
              >
                {isFullyComplete ? 'Build Complete!' : 'Build Status'}
              </motion.h2>

              <motion.p
                className="text-bolt-elements-textSecondary mb-8 text-lg bg-bolt-elements-background-depth-2/30 px-4 py-2 rounded-xl inline-block border border-bolt-elements-borderColor/30"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
              >
                {isFullyComplete
                  ? 'Congratulations! All features have been successfully implemented.'
                  : 'Great progress! Your app is taking shape.'}
              </motion.p>

              <motion.div
                className="mb-8 p-4 bg-bolt-elements-background-depth-2/30 rounded-2xl border border-bolt-elements-borderColor/30"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-semibold text-bolt-elements-textPrimary">Features Complete</span>
                  <span className="text-sm font-bold text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 px-3 py-1 rounded-lg border border-bolt-elements-borderColor/50 shadow-sm">
                    {completedFeatures}/{totalFeatures}
                  </span>
                </div>

                <div className="w-full bg-bolt-elements-background-depth-3 rounded-xl h-4 overflow-hidden shadow-inner border border-bolt-elements-borderColor/30">
                  <motion.div
                    className={classNames(
                      'h-full rounded-xl shadow-sm',
                      isFullyComplete
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gradient-to-r from-blue-500 to-purple-500',
                    )}
                    variants={progressBarVariants}
                    initial="hidden"
                    animate="visible"
                  />
                </div>

                {totalFeatures > 0 && (
                  <div className="mt-6 space-y-3 max-h-40 overflow-y-auto">
                    {features.map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between text-sm p-3 bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor/30 shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <span className="text-bolt-elements-textPrimary truncate font-medium">{feature.name}</span>
                        <div
                          className={classNames(
                            'flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium border shadow-sm',
                            feature.status === AppFeatureStatus.Validated
                              ? 'text-green-700 bg-green-50 border-green-200'
                              : feature.status === AppFeatureStatus.Implemented
                                ? 'text-blue-700 bg-blue-50 border-blue-200'
                                : feature.status === AppFeatureStatus.ValidationFailed
                                  ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                                  : 'text-bolt-elements-textSecondary bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor',
                          )}
                        >
                          {feature.status === AppFeatureStatus.Validated && (
                            <div className="i-ph:check-circle-fill text-sm text-green-600 transition-transform duration-200 hover:scale-110" />
                          )}
                          {feature.status === AppFeatureStatus.Implemented && (
                            <div className="i-ph:gear text-sm text-blue-600 transition-transform duration-200 hover:scale-110" />
                          )}
                          {feature.status === AppFeatureStatus.ValidationFailed && (
                            <div className="i-ph:warning-circle-fill text-sm text-yellow-600 transition-transform duration-200 hover:scale-110" />
                          )}
                          {(feature.status === AppFeatureStatus.NotStarted ||
                            feature.status === AppFeatureStatus.ImplementationInProgress) && (
                            <div className="i-ph:circle text-sm text-bolt-elements-textSecondary transition-transform duration-200 hover:scale-110" />
                          )}
                          <span className="capitalize">
                            {feature.status === AppFeatureStatus.ImplementationInProgress
                              ? 'In Progress'
                              : feature.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div
                className="flex flex-col gap-4 justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5 }}
              >
                {!isFullyComplete && peanutsErrorButton && (
                  <div className="flex flex-col items-center w-full">
                    <WithTooltip tooltip={peanutsErrorInfo}>
                      <button
                        onClick={handleContinueBuilding}
                        disabled={true}
                        className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 bg-gray-500 text-white flex items-center gap-3 opacity-50 cursor-not-allowed border border-gray-400/30 shadow-sm"
                      >
                        <div className="i-ph:rocket-launch text-xl text-white"></div>
                        <span className="text-white">{peanutsErrorButton}</span>
                      </button>
                    </WithTooltip>
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm max-w-md text-center">
                      {peanutsErrorInfo}
                    </div>
                  </div>
                )}
                {!isFullyComplete && !peanutsErrorButton && (
                  <div className="flex justify-center items-center w-full">
                    <button
                      onClick={handleContinueBuilding}
                      className="px-6 py-3 rounded-xl font-semibold transition-all duration-200 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white flex items-center gap-3 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group"
                    >
                      <div className="i-ph:rocket-launch text-xl transition-transform duration-200 group-hover:scale-110"></div>
                      <span className="transition-transform duration-200 group-hover:scale-105">Continue Building</span>
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

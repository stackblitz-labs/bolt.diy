import { useStore } from '@nanostores/react';
import { appSettingsModalStore } from '~/lib/stores/appSettingsModal';
import { chatStore } from '~/lib/stores/chat';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { AuthSelectorComponent } from './components/AuthSelectorComponent';
import { SecretsComponent } from './components/SecretsComponent';
import { PermissionsSelectionComponent } from './components/PermissionsSelectionComponent';
import { ExperimentalFeaturesComponent } from './components/ExperimentalFeaturesComponent';
import { AppAccessKind, isAppAccessAllowed } from '~/lib/api/permissions';
import { isAppOwnerStore, permissionsStore } from '~/lib/stores/permissions';
import { userStore } from '~/lib/stores/userAuth';
import CopyApp from './components/CopyApp';
import { X, Settings, Type } from '~/components/ui/Icon';

export function GlobalAppSettingsModal() {
  const isOpen = useStore(appSettingsModalStore.isOpen);
  const loadingData = useStore(appSettingsModalStore.loadingData);
  const appSummary = useStore(chatStore.appSummary);
  const allSecrets = appSummary?.features?.flatMap((f) => f.secrets ?? []) ?? [];
  const appId = useStore(chatStore.currentAppId);
  const permissions = useStore(permissionsStore);
  const isAppOwner = useStore(isAppOwnerStore);
  const user = useStore(userStore.user);

  const handleCloseModal = () => {
    appSettingsModalStore.close();
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

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1001] flex items-center justify-center p-2 sm:p-4"
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCloseModal} />

        <motion.div
          className="relative bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor border-opacity-50 rounded-2xl shadow-2xl hover:shadow-3xl transition-shadow duration-300 max-w-2xl w-full mx-2 sm:mx-4 max-h-[95vh] flex flex-col backdrop-blur-sm"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={handleCloseModal}
              className="w-10 h-10 rounded-2xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group"
            >
              <X className="transition-transform duration-200 group-hover:scale-110" size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            {loadingData ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-bolt-elements-background-depth-2 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-bolt-elements-borderColor">
                  <div className="w-8 h-8 border-2 border-bolt-elements-borderColor border-t-blue-500 rounded-full animate-spin" />
                </div>
                <h3 className="text-xl font-semibold text-bolt-elements-textHeading mb-2">Loading settings...</h3>
                <p className="text-bolt-elements-textSecondary">Please wait while we load your app settings</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-bolt-elements-background-depth-2 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-bolt-elements-borderColor">
                    <Settings className="text-bolt-elements-textSecondary" size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-bolt-elements-textHeading">App Settings</h2>
                  <p className="text-bolt-elements-textSecondary mt-2">
                    Configure your application settings and preferences
                  </p>
                </div>

                <div className="space-y-6">
                  {/* App Name Section */}
                  <div className="p-5 bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor">
                    <h3 className="text-base font-semibold text-bolt-elements-textHeading mb-3 flex items-center gap-2">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm bg-blue-500">
                        <Type className="text-white" size={18} />
                      </div>
                      App Name
                    </h3>
                    <ChatDescription />
                  </div>

                  {/* Copy App */}
                  {appId && isAppAccessAllowed(permissions, AppAccessKind.Copy, user?.email ?? '', isAppOwner) && (
                    <CopyApp />
                  )}

                  {/* Authentication Settings */}
                  {appSummary && <AuthSelectorComponent appSummary={appSummary} />}

                  {/* Permissions */}
                  {appId &&
                    isAppAccessAllowed(permissions, AppAccessKind.SetPermissions, user?.email ?? '', isAppOwner) && (
                      <PermissionsSelectionComponent />
                    )}

                  {/* API Integrations */}
                  {appSummary && allSecrets.length > 0 && <SecretsComponent appSummary={appSummary} />}

                  {/* Experimental Features */}
                  {appSummary && <ExperimentalFeaturesComponent />}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-bolt-elements-borderColor">
                  <button
                    onClick={handleCloseModal}
                    className="px-6 py-3 bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover border border-bolt-elements-borderColor rounded-2xl transition-all duration-200 font-medium"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

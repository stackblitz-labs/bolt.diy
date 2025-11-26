import { useStore } from '@nanostores/react';
import { deployModalStore } from '~/lib/stores/deployModal';
import { chatStore } from '~/lib/stores/chat';
import { database } from '~/lib/persistence/apps';
import { lastDeployResult, deployApp } from '~/lib/replay/Deploy';
import { generateRandomId } from '~/utils/nut';
import { DeployStatus } from '~/components/header/components/DeployChat/DeployChatButton';
import { motion, AnimatePresence } from 'framer-motion';
import DeploymentSuccessful from './DeploymentSuccessful';
import { userStore } from '~/lib/stores/auth';
import { X, Rocket, CheckCircle, AlertTriangle } from '~/components/ui/Icon';
import { isAppOwnerStore, permissionsStore } from '~/lib/stores/permissions';
import { isAppAccessAllowed, AppAccessKind } from '~/lib/api/permissions';

const MAX_SITE_NAME_LENGTH = 63;

export function GlobalDeployChatModal() {
  const isOpen = useStore(deployModalStore.isOpen);
  const status = useStore(deployModalStore.status);
  const deploySettings = useStore(deployModalStore.deploySettings);
  const error = useStore(deployModalStore.error);
  const databaseFound = useStore(deployModalStore.databaseFound);
  const loadingData = useStore(deployModalStore.loadingData);
  const user = useStore(userStore);
  const permissions = useStore(permissionsStore);
  const isAppOwner = useStore(isAppOwnerStore);

  const appId = useStore(chatStore.currentAppId);

  const handleCloseModal = () => {
    deployModalStore.close();
  };

  const handleDeploy = async () => {
    deployModalStore.setError(undefined);

    if (!appId) {
      deployModalStore.setError('No app open');
      return;
    }

    const currentSettings = deployModalStore.deploySettings.get();
    const settingsToUse = { ...currentSettings };

    if (!settingsToUse.siteName) {
      const appTitle = chatStore.appTitle.get();
      let siteName = appTitle
        ? appTitle
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || 'nut-app'
        : 'nut-app';

      const suffix = `-${generateRandomId()}`;
      siteName = siteName.slice(0, MAX_SITE_NAME_LENGTH - suffix.length);
      settingsToUse.siteName = `${siteName}${suffix}`;
    }

    if (settingsToUse.siteName.length > MAX_SITE_NAME_LENGTH) {
      deployModalStore.setError(`Site name must be shorter than ${MAX_SITE_NAME_LENGTH + 1} characters`);
      return;
    }

    deployModalStore.setStatus(DeployStatus.Started);

    // Write out to the database before we start trying to deploy.
    await database.setAppDeploySettings(appId, settingsToUse);

    const result = await deployApp(appId, settingsToUse);

    if (result.error) {
      deployModalStore.setError(result.error);
    }

    if (window.analytics) {
      window.analytics.track('Deployed App', {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        email: user?.email,
      });
    }

    const updatedSettings = {
      ...settingsToUse,
      results: [...(settingsToUse.results || []), result],
    };

    deployModalStore.setDeploySettings(updatedSettings);
    deployModalStore.setStatus(result.error ? DeployStatus.NotStarted : DeployStatus.Succeeded);
  };

  const handleSetDeploySettings = (settings: typeof deploySettings) => {
    deployModalStore.setDeploySettings(settings);
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
              className="w-10 h-10 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 transition-all duration-200 flex items-center justify-center text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary shadow-sm hover:shadow-md hover:scale-105 group"
            >
              <X className="transition-transform duration-200 group-hover:scale-110" size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            {loadingData ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-lg">
                  <div className="w-8 h-8 border-2 border-bolt-elements-borderColor border-opacity-30 border-t-blue-500 rounded-full animate-spin" />
                </div>
                <h3 className="text-2xl font-bold text-bolt-elements-textHeading mb-3">Loading data...</h3>
                <p className="text-bolt-elements-textSecondary">
                  Please wait while we prepare your deployment settings
                </p>
              </div>
            ) : status === DeployStatus.Succeeded ? (
              <DeploymentSuccessful result={lastDeployResult(deploySettings)} setIsModalOpen={handleCloseModal} />
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-lg">
                    <Rocket className="text-blue-500" size={24} />
                  </div>
                  <h2 className="text-3xl font-bold text-bolt-elements-textHeading">Deploy Your Application</h2>
                  <p className="text-bolt-elements-textSecondary mt-2">
                    Get your app live on the web in just a few clicks
                  </p>
                </div>

                {/* Easy Deploy Section */}
                <div className="mb-8 p-6 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-2xl border border-bolt-elements-borderColor border-opacity-30 shadow-lg hover:shadow-xl transition-shadow duration-300">
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-2xl">⚡</span>
                      <h3 className="text-xl font-bold text-bolt-elements-textHeading">Quick Deploy</h3>
                    </div>
                    <p className="text-bolt-elements-textSecondary leading-relaxed">
                      Deploy instantly with smart defaults. No configuration needed - we'll handle everything for you
                      {databaseFound ? ', including database setup' : ''}.
                    </p>
                  </div>

                  {/* Show existing site in easy deploy */}
                  {lastDeployResult(deploySettings)?.siteURL && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 shadow-sm">
                      <div className="flex flex-col items-center justify-between gap-2">
                        <div className="text-sm text-green-700 font-semibold flex items-center gap-2">
                          <CheckCircle className="text-green-500" size={18} />
                          Your App's URL:
                        </div>
                        <a
                          href={lastDeployResult(deploySettings)?.siteURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={lastDeployResult(deploySettings)?.siteURL}
                          className="w-full text-sm text-green-600 hover:text-green-700 transition-colors underline truncate font-medium padding-x-2 ellipsis"
                        >
                          {lastDeployResult(deploySettings)?.siteURL}
                        </a>
                      </div>
                    </div>
                  )}

                  {(permissions.length === 0 ||
                    (permissions.length > 0 &&
                      isAppAccessAllowed(permissions, AppAccessKind.SendMessage, user?.email ?? '', isAppOwner))) && (
                    <div className="flex justify-center">
                      {status === DeployStatus.Started ? (
                        <div className="w-full text-bolt-elements-textSecondary flex items-center justify-center py-4 bg-bolt-elements-background-depth-1 bg-opacity-50 rounded-xl border border-bolt-elements-borderColor border-opacity-30">
                          <div className="w-6 h-6 border-2 border-bolt-elements-borderColor border-opacity-30 border-t-blue-500 rounded-full animate-spin mr-3" />
                          <span className="text-lg font-medium">
                            {lastDeployResult(deploySettings)?.siteURL ? 'Redeploying' : 'Deploying'} your app...
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={handleDeploy}
                          className="flex items-center gap-3 px-8 py-4 !bg-gradient-to-r !from-blue-500 !to-indigo-500 hover:!from-blue-600 hover:!to-indigo-600 text-white text-lg font-semibold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 group"
                        >
                          <Rocket className="transition-transform duration-200 group-hover:scale-110" size={20} />
                          <span className="transition-transform duration-200 group-hover:scale-105">
                            {lastDeployResult(deploySettings)?.siteURL ? 'Redeploy' : 'Deploy Now'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-xl border border-bolt-elements-borderColor border-opacity-30 space-y-4">
                  <div>
                    <label
                      htmlFor="siteName"
                      className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary"
                    >
                      Site Name (optional)
                    </label>
                    <p className="text-sm text-bolt-elements-textSecondary leading-relaxed mb-3">
                      Choose a custom prefix for your site's URL.
                    </p>
                    <div className="relative">
                      <input
                        id="siteName"
                        name="siteName"
                        type="text"
                        className="w-full p-4 pr-32 border rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary border-bolt-elements-borderColor border-opacity-50 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200 shadow-sm focus:shadow-md"
                        value={deploySettings.siteName || ''}
                        placeholder="my-chat-app..."
                        disabled={
                          !(
                            permissions.length === 0 ||
                            (permissions.length > 0 &&
                              isAppAccessAllowed(permissions, AppAccessKind.SendMessage, user?.email ?? '', isAppOwner))
                          )
                        }
                        onChange={(e) => {
                          handleSetDeploySettings({
                            ...deploySettings,
                            siteName: e.target.value,
                          });
                        }}
                      />
                    </div>
                    {deploySettings.siteName && (
                      <div className="mt-2 p-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-lg border border-blue-500/20">
                        <p className="text-sm text-bolt-elements-textSecondary">
                          <span className="font-medium text-bolt-elements-textPrimary">
                            Your site will be available at:
                          </span>
                          <br />
                          <span className="font-mono text-blue-600 text-sm">
                            https://{deploySettings.siteName}.netlify.app
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleCloseModal}
                    disabled={status === DeployStatus.Started}
                    className="px-6 py-3 bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md hover:scale-[1.02] group"
                  >
                    <span className="transition-transform duration-200 group-hover:scale-105">Cancel</span>
                  </button>
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                      <div>
                        <p className="font-semibold mb-1">Deployment Error</p>
                        <p className="text-sm leading-relaxed">{error}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

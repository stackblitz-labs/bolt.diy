import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { database } from '~/lib/persistence/apps';
import { lastDeployResult, deployApp } from '~/lib/replay/Deploy';
import { generateRandomId } from '~/utils/nut';
import { DeployStatus } from '~/components/header/DeployChat/DeployChatButton';
import DeploymentSuccessful from '~/components/header/DeployChat/components/DeploymentSuccessful';
import { userStore } from '~/lib/stores/auth';
import { Rocket, CheckCircle, AlertTriangle } from '~/components/ui/Icon';
import { deployModalStore } from '~/lib/stores/deployModal';
import { useEffect } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import { Skeleton } from '~/components/ui/Skeleton';

const MAX_SITE_NAME_LENGTH = 63;

export const DeployPanel = () => {
  const status = useStore(deployModalStore.status);
  const deploySettings = useStore(deployModalStore.deploySettings);
  const error = useStore(deployModalStore.error);
  const databaseFound = useStore(deployModalStore.databaseFound);
  const loadingData = useStore(deployModalStore.loadingData);
  const user = useStore(userStore);
  const appId = useStore(chatStore.currentAppId);
  const repositoryId = useStore(workbenchStore.repositoryId);

  // Load deploy settings when app/repository changes (data is cached in store)
  useEffect(() => {
    if (appId && repositoryId) {
      // This will use cached data if already loaded, or load it if not
      deployModalStore.loadData(appId, repositoryId);
    }
  }, [appId, repositoryId]);

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

  if (!appId || !repositoryId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-bolt-elements-textSecondary">No app loaded</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 rounded-xl border border-bolt-elements-borderColor overflow-hidden">
      <div className="bg-bolt-elements-background-depth-1 border-b border-bolt-elements-borderColor border-opacity-50 shadow-sm rounded-t-xl">
        <div className="flex items-center gap-2 px-4 h-[38px]">
          <div className="flex-1 text-bolt-elements-textSecondary text-sm font-medium truncate">Deploy</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          {loadingData ? (
            <div className="space-y-8">
              {/* Header skeleton */}
              <div className="text-center mb-8">
                <Skeleton className="w-16 h-16 rounded-2xl mx-auto mb-4" />
                <Skeleton className="h-9 w-64 mx-auto mb-3" />
                <Skeleton className="h-5 w-80 mx-auto" />
              </div>

              {/* Quick Deploy section skeleton */}
              <div className="p-6 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-2xl border border-bolt-elements-borderColor border-opacity-30 space-y-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Skeleton className="h-6 w-6 rounded" />
                    <Skeleton className="h-7 w-32" />
                  </div>
                  <Skeleton className="h-5 w-full max-w-md mx-auto" />
                  <Skeleton className="h-5 w-full max-w-sm mx-auto" />
                </div>
                <div className="flex justify-center">
                  <Skeleton className="h-12 w-40 rounded-xl" />
                </div>
              </div>

              {/* Site Name section skeleton */}
              <div className="p-4 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-xl border border-bolt-elements-borderColor border-opacity-30 space-y-4">
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-full max-w-md mb-3" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              </div>
            </div>
          ) : status === DeployStatus.Succeeded ? (
            <DeploymentSuccessful result={lastDeployResult(deploySettings)} setIsModalOpen={() => {}} />
          ) : (
            <>
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
                        className="text-sm text-green-600 hover:text-green-700 transition-colors underline truncate font-medium"
                      >
                        {lastDeployResult(deploySettings)?.siteURL}
                      </a>
                    </div>
                  </div>
                )}

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
              </div>

              <div className="p-4 bg-bolt-elements-background-depth-2 bg-opacity-30 rounded-xl border border-bolt-elements-borderColor border-opacity-30 space-y-4">
                <div>
                  <label htmlFor="siteName" className="block mb-2 text-sm font-semibold text-bolt-elements-textPrimary">
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
      </div>
    </div>
  );
};

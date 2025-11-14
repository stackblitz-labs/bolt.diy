import { useEffect } from 'react';

import { useStore } from '@nanostores/react';

import { chatStore } from '~/lib/stores/chat';

import { ChatDescription } from '~/lib/persistence/ChatDescription.client';

import { AuthSelectorComponent } from '~/components/header/AppSettings/components/AuthSelectorComponent';

import { SecretsComponent } from '~/components/header/AppSettings/components/SecretsComponent';

import { PermissionsSelectionComponent } from '~/components/header/AppSettings/components/PermissionsSelectionComponent';

import { ExperimentalFeaturesComponent } from '~/components/header/AppSettings/components/ExperimentalFeaturesComponent';

import { AppAccessKind, isAppAccessAllowed } from '~/lib/api/permissions';

import { isAppOwnerStore, permissionsStore, setIsAppOwner } from '~/lib/stores/permissions';

import { userStore } from '~/lib/stores/auth';

import CopyApp from '~/components/header/AppSettings/components/CopyApp';

import DownloadSourceCode from '~/components/header/AppSettings/components/DownloadSourceCode';

import { Settings, Type } from '~/components/ui/Icon';

import { hasExperimentalFeatures } from '~/lib/stores/experimentalFeatures';

import { isAppOwner } from '~/lib/api/permissions';

export const AppSettingsPanel = () => {
  const appSummary = useStore(chatStore.appSummary);

  const allSecrets = appSummary?.features?.flatMap((f) => f.secrets ?? []) ?? [];

  const appId = useStore(chatStore.currentAppId);

  const permissions = useStore(permissionsStore);

  const isOwner = useStore(isAppOwnerStore);

  const user = useStore(userStore);

  useEffect(() => {
    const loadIsOwner = async () => {
      const isOwner = await isAppOwner(appId ?? '', user?.id ?? '');
      setIsAppOwner(isOwner);
    };
    loadIsOwner();
  }, [appId, user?.id]);

  if (!appId) {
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
          <div className="flex-1 text-bolt-elements-textSecondary text-sm font-medium truncate">App Settings</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-3xl mx-auto">
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
          {appId && isAppAccessAllowed(permissions, AppAccessKind.Copy, user?.email ?? '', isOwner) && <CopyApp />}

          {/* Download Source Code */}
          {appSummary && <DownloadSourceCode />}

          {/* Authentication Settings */}
          {appSummary && <AuthSelectorComponent appSummary={appSummary} />}

          {/* Permissions */}
          {appId && isAppAccessAllowed(permissions, AppAccessKind.SetPermissions, user?.email ?? '', isOwner) && (
            <PermissionsSelectionComponent />
          )}

          {/* API Integrations */}
          {appSummary && allSecrets.length > 0 && <SecretsComponent appSummary={appSummary} />}

          {/* Experimental Features */}
          {appSummary && hasExperimentalFeatures() && <ExperimentalFeaturesComponent />}
        </div>
      </div>
    </div>
  );
};

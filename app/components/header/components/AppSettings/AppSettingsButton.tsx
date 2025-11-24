import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { appSettingsModalStore } from '~/lib/stores/appSettingsModal';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { toast } from 'react-toastify';
import { Settings } from '~/components/ui/Icon';

export function AppSettingsButton() {
  const appId = useStore(chatStore.currentAppId);
  const appTitle = useStore(chatStore.appTitle);
  const loadingData = useStore(appSettingsModalStore.loadingData);

  const handleOpenModal = async () => {
    if (!appId) {
      toast.error('No app ID found');
      return;
    }

    appSettingsModalStore.setLoadingData(true);
    appSettingsModalStore.open();

    try {
      // Load current app settings
      const currentSettings = {
        name: appTitle || 'New App',
        authenticationRequired: false,
        domainWhitelist: [],
        apiIntegrations: [
          { name: 'OpenAI', configured: true, credentialsSet: true },
          { name: 'Anthropic', configured: true, credentialsSet: true },
          { name: 'Email Notifications', configured: false, credentialsSet: false },
          { name: 'External Services', configured: false, credentialsSet: false },
        ],
      };

      appSettingsModalStore.setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading app settings:', error);
      toast.error('Failed to load app settings');
      appSettingsModalStore.setError('Failed to load app settings');
    }

    appSettingsModalStore.setLoadingData(false);
  };

  return (
    <TooltipProvider>
      <WithTooltip tooltip="App Settings">
        <button
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-xl p-2.5 transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20 hover:border-white/30 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 group"
          onClick={handleOpenModal}
          disabled={loadingData}
        >
          {loadingData ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Settings
              className="text-white drop-shadow-sm transition-transform duration-200 group-hover:scale-110"
              size={20}
            />
          )}
        </button>
      </WithTooltip>
    </TooltipProvider>
  );
}

import { useEffect, useState } from 'react';
import { FlaskConical, MessageCircle, Sparkles } from '~/components/ui/Icon';
import { AppMessagesSecret, DisableAppBlockChangesSecret } from '~/lib/persistence/messageAppSummary';
import type { AppSummary } from '~/lib/persistence/messageAppSummary';
import { toast } from 'react-toastify';
import { chatStore } from '~/lib/stores/chat';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import { Switch } from '~/components/ui/Switch';
import { AppCard } from '~/components/chat/Messages/components/AppCard';
import { getAppSetSecrets, setAppSecrets } from '~/lib/replay/Secrets';

interface ExperimentalFeaturesComponentProps {
  appSummary: AppSummary;
}

export const ExperimentalFeaturesComponent: React.FC<ExperimentalFeaturesComponentProps> = ({ appSummary }) => {
  const [saving, setSaving] = useState(false);
  const [setSecrets, setSetSecrets] = useState<string[]>([]);
  const appMessagesEnabled = setSecrets.includes(AppMessagesSecret);
  const disableAppBlockChanges = setSecrets.includes(DisableAppBlockChangesSecret);
  const appId = chatStore.currentAppId.get();

  useEffect(() => {
    const fetchSetSecrets = async () => {
      const setSecrets = await getAppSetSecrets(appId!);
      setSetSecrets(setSecrets);
    };
    fetchSetSecrets();
  }, [appSummary]);

  const handleAppMessagesToggle = async () => {
    setSaving(true);

    try {
      await setAppSecrets(appId!, [
        {
          key: AppMessagesSecret,
          value: appMessagesEnabled ? undefined : 'true',
        },
      ]);

      toast.success('In-app feedback settings updated successfully');
    } catch (error) {
      toast.error('Failed to update in-app feedback settings');
      console.error('Failed to update in-app feedback settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAppBlockChangesToggle = async () => {
    setSaving(true);

    try {
      await setAppSecrets(appId!, [
        {
          key: DisableAppBlockChangesSecret,
          value: disableAppBlockChanges ? undefined : 'true',
        },
      ]);

      toast.success('App block changes settings updated successfully');
    } catch (error) {
      toast.error('Failed to update app block changes settings');
      console.error('Failed to update app block changes settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const getDescription = () => {
    const enabledFeatures = [];
    if (appMessagesEnabled) {
      enabledFeatures.push('in-app feedback');
    }
    if (!disableAppBlockChanges) {
      enabledFeatures.push('builder improvements');
    }

    if (enabledFeatures.length === 0) {
      return 'Enable experimental features to enhance your app experience';
    }
    return `Active features: ${enabledFeatures.join(', ')}`;
  };

  const getAppMessagesToggleControl = () => {
    const tooltipText = appMessagesEnabled
      ? 'Disable in-app updates and bug reporting'
      : 'Enable updating and reporting bugs directly from the app';

    return (
      <TooltipProvider>
        <WithTooltip tooltip={tooltipText}>
          <button
            className={`group relative p-4 bg-bolt-elements-background-depth-2 rounded-xl border transition-all duration-200 w-full shadow-sm overflow-hidden ${
              saving
                ? 'border-bolt-elements-borderColor border-opacity-30 cursor-not-allowed opacity-60'
                : 'border-bolt-elements-borderColor hover:border-bolt-elements-focus/60 hover:bg-bolt-elements-background-depth-3 hover:shadow-md hover:scale-[1.01] cursor-pointer'
            } ${appMessagesEnabled ? 'border-opacity-50' : ''}`}
            onClick={!saving ? handleAppMessagesToggle : undefined}
            disabled={saving}
            type="button"
          >
            {appMessagesEnabled && (
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 opacity-50" />
            )}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    appMessagesEnabled
                      ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30'
                      : 'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor/50'
                  }`}
                >
                  <MessageCircle
                    className={
                      appMessagesEnabled
                        ? 'text-blue-500'
                        : 'text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary'
                    }
                    size={18}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-bolt-elements-textPrimary transition-all duration-200 group-hover:scale-[1.02]">
                    {appMessagesEnabled ? 'In-App Feedback Enabled' : 'Enable In-App Feedback'}
                  </span>
                  <span className="text-xs text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary/80 transition-all duration-200 leading-relaxed">
                    {saving
                      ? 'Updating...'
                      : appMessagesEnabled
                        ? 'Users can report issues or request updates directly in the app'
                        : 'In-app issue reporting disabled'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {saving && (
                  <div className="w-4 h-4 rounded-full border-2 border-bolt-elements-borderColor border-t-blue-500 animate-spin" />
                )}
                <Switch
                  checked={appMessagesEnabled}
                  onCheckedChange={!saving ? handleAppMessagesToggle : undefined}
                  className={`${saving ? 'opacity-50' : 'group-hover:scale-105'} transition-all duration-200 pointer-events-none`}
                />
              </div>
            </div>
          </button>
        </WithTooltip>
      </TooltipProvider>
    );
  };

  const getAppBlockChangesToggleControl = () => {
    const tooltipText = disableAppBlockChanges
      ? 'Enable Builder improvements based on developed changes'
      : 'Disable Builder improvements based on developed changes';

    const isEnabled = !disableAppBlockChanges;

    return (
      <TooltipProvider>
        <WithTooltip tooltip={tooltipText}>
          <button
            className={`group relative p-4 bg-bolt-elements-background-depth-2 rounded-xl border transition-all duration-200 w-full shadow-sm overflow-hidden ${
              saving
                ? 'border-bolt-elements-borderColor border-opacity-30 cursor-not-allowed opacity-60'
                : 'border-bolt-elements-borderColor hover:border-bolt-elements-focus/60 hover:bg-bolt-elements-background-depth-3 hover:shadow-md hover:scale-[1.01] cursor-pointer'
            } ${isEnabled ? 'border-opacity-50' : ''}`}
            onClick={!saving ? handleAppBlockChangesToggle : undefined}
            disabled={saving}
            type="button"
          >
            {isEnabled && (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-purple-500/5 opacity-50" />
            )}
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                    isEnabled
                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                      : 'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor/50'
                  }`}
                >
                  <Sparkles
                    className={
                      isEnabled
                        ? 'text-purple-500'
                        : 'text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary'
                    }
                    size={18}
                  />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-bolt-elements-textPrimary transition-all duration-200 group-hover:scale-[1.02]">
                    {disableAppBlockChanges ? 'Builder Improvement Disabled' : 'Builder Improvement Enabled'}
                  </span>
                  <span className="text-xs text-bolt-elements-textSecondary group-hover:text-bolt-elements-textPrimary/80 transition-all duration-200 leading-relaxed">
                    {saving
                      ? 'Updating...'
                      : disableAppBlockChanges
                        ? 'Developed changes will not be used to improve future apps'
                        : 'Use developed changes to improve future apps for everyone'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                {saving && (
                  <div className="w-4 h-4 rounded-full border-2 border-bolt-elements-borderColor border-t-purple-500 animate-spin" />
                )}
                <Switch
                  checked={disableAppBlockChanges}
                  onCheckedChange={!saving ? handleAppBlockChangesToggle : undefined}
                  className={`${saving ? 'opacity-50' : 'group-hover:scale-105'} transition-all duration-200 pointer-events-none`}
                />
              </div>
            </div>
          </button>
        </WithTooltip>
      </TooltipProvider>
    );
  };

  return (
    <AppCard
      title="Experimental Features"
      description={getDescription()}
      icon={<FlaskConical className="text-white" size={18} />}
      iconColor="purple"
      status={null}
      progressText=""
    >
      <div className="space-y-3">
        {getAppMessagesToggleControl()}
        {getAppBlockChangesToggleControl()}
      </div>
    </AppCard>
  );
};

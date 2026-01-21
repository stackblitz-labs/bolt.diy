import { useEffect, useState } from 'react';
import { FlaskConical, MessageCircle, Sparkles } from '~/components/ui/Icon';
import { AppMessagesSecret, DisableAppBlockChangesSecret } from '~/lib/persistence/messageAppSummary';
import type { AppSummary } from '~/lib/persistence/messageAppSummary';
import { toast } from 'react-toastify';
import { chatStore } from '~/lib/stores/chat';
import { Switch } from '~/components/ui/Switch';
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

      setSetSecrets((prev) =>
        appMessagesEnabled ? prev.filter((s) => s !== AppMessagesSecret) : [...prev, AppMessagesSecret],
      );

      toast.success('In-app feedback settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
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

      setSetSecrets((prev) =>
        disableAppBlockChanges
          ? prev.filter((s) => s !== DisableAppBlockChangesSecret)
          : [...prev, DisableAppBlockChangesSecret],
      );

      toast.success('Builder improvements settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
      console.error('Failed to update app block changes settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="text-bolt-elements-textSecondary" size={16} />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-bolt-elements-textPrimary">Experimental Features</h3>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">
            Enable experimental features to enhance your app
          </p>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="space-y-3">
        {/* In-App Feedback */}
        <div className="flex items-start gap-3">
          <Switch
            checked={appMessagesEnabled}
            onCheckedChange={!saving ? handleAppMessagesToggle : undefined}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <MessageCircle className="text-bolt-elements-textSecondary" size={14} />
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary">In-App Feedback</h4>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary mt-0.5">
              {appMessagesEnabled
                ? 'Users can report issues or request updates directly in the app'
                : 'Enable updating and reporting bugs directly from the app'}
            </p>
          </div>
        </div>

        {/* Builder Improvements */}
        <div className="flex items-start gap-3">
          <Switch
            checked={!disableAppBlockChanges}
            onCheckedChange={!saving ? handleAppBlockChangesToggle : undefined}
            className="mt-0.5"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="text-bolt-elements-textSecondary" size={14} />
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Builder Improvements</h4>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary mt-0.5">
              {!disableAppBlockChanges
                ? 'Use developed changes to improve future apps for everyone'
                : 'Developed changes will not be used to improve future apps'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

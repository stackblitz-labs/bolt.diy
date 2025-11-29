import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { chatStore, onChatResponse } from '~/lib/stores/chat';
import { useStore } from '@nanostores/react';
import { assert } from '~/utils/nut';
import { callNutAPI } from '~/lib/replay/NutAPI';
import { toast } from 'react-toastify';

const AuthSelector = () => {
  const appSummary = useStore(chatStore.appSummary);

  const appId = chatStore.currentAppId.get();
  assert(appId, 'App ID is required');

  const [saving, setSaving] = useState(false);

  const authRequired = appSummary?.setSecrets?.includes(AuthRequiredSecret);

  const handleChange = async () => {
    setSaving(true);

    try {
      const { response } = await callNutAPI('set-app-secrets', {
        appId,
        secrets: [
          {
            key: AuthRequiredSecret,
            value: authRequired ? undefined : 'true',
          },
        ],
      });

      if (response) {
        onChatResponse(response, 'ToggleRequireAuth');
      }

      toast.success('Authentication settings updated successfully');
    } catch (error) {
      toast.error('Failed to update authentication settings');
      console.error('Failed to update authentication settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={classNames(
        'flex items-center gap-3 p-3 mt-0 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors duration-200',
      )}
    >
      <div className="relative flex items-center">
        <input
          type="checkbox"
          id="auth-required"
          checked={authRequired}
          onChange={handleChange}
          disabled={saving}
          className="peer appearance-none h-5 w-5 rounded border-2 border-gray-300 bg-white cursor-pointer checked:bg-blue-600 checked:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {saving ? (
          <div className="absolute left-0 w-5 h-5 flex items-center justify-center">
            <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <svg
            className="absolute left-0 w-5 h-5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white transition-opacity duration-200"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <label className="text-gray-700 cursor-pointer text-sm font-medium select-none" htmlFor="auth-required">
        Require users to login
      </label>
    </div>
  );
};

export default AuthSelector;

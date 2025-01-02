import React, { useState } from 'react';
import { useNavigate } from '@remix-run/react';
import Cookies from 'js-cookie';
import { toast } from 'react-toastify';
import { db, deleteById, getAll } from '~/lib/persistence';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';

// List of supported providers that can have API keys
const API_KEY_PROVIDERS = [
  'Anthropic',
  'OpenAI',
  'Google',
  'Groq',
  'HuggingFace',
  'OpenRouter',
  'Deepseek',
  'Mistral',
  'OpenAILike',
  'Together',
  'xAI',
  'Perplexity',
  'Cohere',
  'AzureOpenAI',
  'AmazonBedrock',
] as const;

interface ApiKeys {
  [key: string]: string;
}

export default function DataTab() {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);

  const downloadAsJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportAllChats = async () => {
    if (!db) {
      const error = new Error('Database is not available');
      logStore.logError('Failed to export chats - DB unavailable', error);
      toast.error('Database is not available');

      return;
    }

    try {
      const allChats = await getAll(db);
      const exportData = {
        chats: allChats,
        exportDate: new Date().toISOString(),
      };

      downloadAsJson(exportData, `all-chats-${new Date().toISOString()}.json`);
      logStore.logSystem('Chats exported successfully', { count: allChats.length });
      toast.success('Chats exported successfully');
    } catch (error) {
      logStore.logError('Failed to export chats', error);
      toast.error('Failed to export chats');
      console.error(error);
    }
  };

  const handleDeleteAllChats = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete all chats? This action cannot be undone.');

    if (!confirmDelete) {
      return;
    }

    if (!db) {
      const error = new Error('Database is not available');
      logStore.logError('Failed to delete chats - DB unavailable', error);
      toast.error('Database is not available');

      return;
    }

    try {
      setIsDeleting(true);

      const allChats = await getAll(db);
      await Promise.all(allChats.map((chat) => deleteById(db!, chat.id)));
      logStore.logSystem('All chats deleted successfully', { count: allChats.length });
      toast.success('All chats deleted successfully');
      navigate('/', { replace: true });
    } catch (error) {
      logStore.logError('Failed to delete chats', error);
      toast.error('Failed to delete chats');
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportSettings = () => {
    const settings = {
      providers: Cookies.get('providers'),
      isDebugEnabled: Cookies.get('isDebugEnabled'),
      isEventLogsEnabled: Cookies.get('isEventLogsEnabled'),
      isLocalModelsEnabled: Cookies.get('isLocalModelsEnabled'),
      promptId: Cookies.get('promptId'),
      isLatestBranch: Cookies.get('isLatestBranch'),
      commitHash: Cookies.get('commitHash'),
      eventLogs: Cookies.get('eventLogs'),
      selectedModel: Cookies.get('selectedModel'),
      selectedProvider: Cookies.get('selectedProvider'),
      githubUsername: Cookies.get('githubUsername'),
      githubToken: Cookies.get('githubToken'),
      bolt_theme: localStorage.getItem('bolt_theme'),
    };

    downloadAsJson(settings, 'bolt-settings.json');
    toast.success('Settings exported successfully');
  };

  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string);

        Object.entries(settings).forEach(([key, value]) => {
          if (key === 'bolt_theme') {
            if (value) {
              localStorage.setItem(key, value as string);
            }
          } else if (value) {
            Cookies.set(key, value as string);
          }
        });

        toast.success('Settings imported successfully. Please refresh the page for changes to take effect.');
      } catch (error) {
        toast.error('Failed to import settings. Make sure the file is a valid JSON file.');
        console.error('Failed to import settings:', error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleExportApiKeyTemplate = () => {
    const template: ApiKeys = {};
    API_KEY_PROVIDERS.forEach((provider) => {
      template[`${provider}_API_KEY`] = '';
    });

    template.OPENAI_LIKE_API_BASE_URL = '';
    template.LMSTUDIO_API_BASE_URL = '';
    template.OLLAMA_API_BASE_URL = '';
    template.TOGETHER_API_BASE_URL = '';

    downloadAsJson(template, 'api-keys-template.json');
    toast.success('API keys template exported successfully');
  };

  const handleImportApiKeys = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const apiKeys = JSON.parse(e.target?.result as string);
        let importedCount = 0;
        const consolidatedKeys: Record<string, string> = {};

        API_KEY_PROVIDERS.forEach((provider) => {
          const keyName = `${provider}_API_KEY`;

          if (apiKeys[keyName]) {
            consolidatedKeys[provider] = apiKeys[keyName];
            importedCount++;
          }
        });

        if (importedCount > 0) {
          // Store all API keys in a single cookie as JSON
          Cookies.set('apiKeys', JSON.stringify(consolidatedKeys));

          // Also set individual cookies for backward compatibility
          Object.entries(consolidatedKeys).forEach(([provider, key]) => {
            Cookies.set(`${provider}_API_KEY`, key);
          });

          toast.success(`Successfully imported ${importedCount} API keys/URLs. Refreshing page to apply changes...`);

          // Reload the page after a short delay to allow the toast to be seen
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          toast.warn('No valid API keys found in the file');
        }

        // Set base URLs if they exist
        ['OPENAI_LIKE_API_BASE_URL', 'LMSTUDIO_API_BASE_URL', 'OLLAMA_API_BASE_URL', 'TOGETHER_API_BASE_URL'].forEach(
          (baseUrl) => {
            if (apiKeys[baseUrl]) {
              Cookies.set(baseUrl, apiKeys[baseUrl]);
            }
          },
        );
      } catch (error) {
        toast.error('Failed to import API keys. Make sure the file is a valid JSON file.');
        console.error('Failed to import API keys:', error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="p-4 bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-lg mb-4">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-4">Data Management</h3>
        <div className="space-y-8">
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="text-bolt-elements-textPrimary mb-2">Chat History</h4>
              <p className="text-sm text-bolt-elements-textSecondary mb-4">Export or delete all your chat history.</p>
              <div className="flex gap-4">
                <button
                  onClick={handleExportAllChats}
                  className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-textPrimary rounded-lg transition-colors"
                >
                  Export All Chats
                </button>
                <button
                  onClick={handleDeleteAllChats}
                  disabled={isDeleting}
                  className={classNames(
                    'px-4 py-2 bg-bolt-elements-button-danger-background hover:bg-bolt-elements-button-danger-backgroundHover text-bolt-elements-button-danger-text rounded-lg transition-colors',
                    isDeleting ? 'opacity-50 cursor-not-allowed' : '',
                  )}
                >
                  {isDeleting ? 'Deleting...' : 'Delete All Chats'}
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-bolt-elements-textPrimary mb-2">Settings Backup</h4>
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                Export your settings to a JSON file or import settings from a previously exported file.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleExportSettings}
                  className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-textPrimary rounded-lg transition-colors"
                >
                  Export Settings
                </button>
                <label className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-textPrimary rounded-lg transition-colors cursor-pointer">
                  Import Settings
                  <input type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <h4 className="text-bolt-elements-textPrimary mb-2">API Keys Management</h4>
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                Import API keys from a JSON file or download a template to fill in your keys.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={handleExportApiKeyTemplate}
                  className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-textPrimary rounded-lg transition-colors"
                >
                  Download Template
                </button>
                <label className="px-4 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-textPrimary rounded-lg transition-colors cursor-pointer">
                  Import API Keys
                  <input type="file" accept=".json" onChange={handleImportApiKeys} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

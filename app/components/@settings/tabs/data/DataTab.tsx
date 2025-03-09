import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { DialogRoot, DialogClose, Dialog, DialogTitle } from '~/components/ui/Dialog';
import { db, getAll, deleteById } from '~/lib/persistence';
import Cookies from 'js-cookie';

export default function DataTab() {
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImportingKeys, setIsImportingKeys] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetInlineConfirm, setShowResetInlineConfirm] = useState(false);
  const [showDeleteInlineConfirm, setShowDeleteInlineConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiKeyFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAllChats = async () => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Get all chats from IndexedDB
      const allChats = await getAll(db);
      const exportData = {
        chats: allChats,
        exportDate: new Date().toISOString(),
      };

      // Download as JSON
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bolt-chats-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Chats exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export chats');
    }
  };

  const handleExportSettings = () => {
    try {
      console.log('Starting settings export');

      // Get all localStorage keys
      const allLocalStorageKeys = Object.keys(localStorage);
      console.log('All localStorage keys:', allLocalStorageKeys);

      // Get all cookies
      const allCookies = Cookies.get();
      console.log('All cookies:', Object.keys(allCookies));

      // Create a comprehensive settings object
      const settingsData = {
        // Core settings
        core: {
          // User profile and main settings
          bolt_user_profile: safeGetItem('bolt_user_profile'),
          bolt_settings: safeGetItem('bolt_settings'),
          bolt_profile: safeGetItem('bolt_profile'),
          theme: safeGetItem('theme'),
        },

        // Provider settings (both local and cloud)
        providers: {
          // Provider configurations from localStorage
          provider_settings: safeGetItem('provider_settings'),

          // API keys from cookies
          apiKeys: allCookies.apiKeys,

          // Selected provider and model
          selectedModel: allCookies.selectedModel,
          selectedProvider: allCookies.selectedProvider,

          // Provider-specific settings
          providers: allCookies.providers,
        },

        // Feature settings
        features: {
          // Feature flags
          viewed_features: safeGetItem('bolt_viewed_features'),
          developer_mode: safeGetItem('bolt_developer_mode'),

          // Context optimization
          contextOptimizationEnabled: safeGetItem('contextOptimizationEnabled'),

          // Auto-select template
          autoSelectTemplate: safeGetItem('autoSelectTemplate'),

          // Latest branch
          isLatestBranch: safeGetItem('isLatestBranch'),

          // Event logs
          isEventLogsEnabled: safeGetItem('isEventLogsEnabled'),

          // Energy saver settings
          energySaverMode: safeGetItem('energySaverMode'),
          autoEnergySaver: safeGetItem('autoEnergySaver'),
        },

        // UI configuration
        ui: {
          // Tab configuration
          bolt_tab_configuration: safeGetItem('bolt_tab_configuration'),
          tabConfiguration: allCookies.tabConfiguration,

          // Prompt settings
          promptId: safeGetItem('promptId'),
          cachedPrompt: allCookies.cachedPrompt,
        },

        // Connections
        connections: {
          // Netlify connection
          netlify_connection: safeGetItem('netlify_connection'),

          // GitHub connections
          ...getGitHubConnections(allCookies),
        },

        // Debug and logs
        debug: {
          // Debug settings
          isDebugEnabled: allCookies.isDebugEnabled,
          acknowledged_debug_issues: safeGetItem('bolt_acknowledged_debug_issues'),
          acknowledged_connection_issue: safeGetItem('bolt_acknowledged_connection_issue'),

          // Error logs
          error_logs: safeGetItem('error_logs'),
          bolt_read_logs: safeGetItem('bolt_read_logs'),

          // Event logs
          eventLogs: allCookies.eventLogs,
        },

        // Update settings
        updates: {
          update_settings: safeGetItem('update_settings'),
          last_acknowledged_update: safeGetItem('bolt_last_acknowledged_version'),
        },

        // Chat snapshots (for chat history)
        chatSnapshots: getChatSnapshots(),

        // Raw data (for debugging and complete backup)
        _raw: {
          localStorage: getAllLocalStorage(),
          cookies: allCookies,
        },

        // Export metadata
        _meta: {
          exportDate: new Date().toISOString(),
          version: '2.0',
          appVersion: process.env.NEXT_PUBLIC_VERSION || 'unknown',
        },
      };

      console.log('Export data structure:', Object.keys(settingsData));

      // Create and download the JSON file
      const exportJson = JSON.stringify(settingsData, null, 2);
      console.log('Export size:', exportJson.length, 'bytes');

      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const filename = `bolt-settings-${new Date().toISOString().replace(/:/g, '-')}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Settings exported successfully as', filename);
      toast.success('Settings exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export settings: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      console.log('Importing settings file:', file.name);

      const importedData = JSON.parse(content);
      console.log('Parsed import data structure:', Object.keys(importedData));

      // Check if this is the new comprehensive format (v2.0)
      const isNewFormat = importedData._meta?.version === '2.0';
      console.log('Import format version:', isNewFormat ? '2.0' : 'legacy');

      if (isNewFormat) {
        // Import using the new comprehensive format
        await importComprehensiveFormat(importedData);
      } else {
        // Try to handle older formats
        await importLegacyFormat(importedData);
      }

      console.log('Settings import completed, reloading page');
      toast.success('Settings imported successfully');

      // Use setTimeout to ensure the toast is shown before reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import settings: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper function to import the new comprehensive format
  const importComprehensiveFormat = async (data: any) => {
    console.log('Importing using comprehensive format');

    // Import core settings
    if (data.core) {
      console.log('Importing core settings:', Object.keys(data.core));
      Object.entries(data.core).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing core setting ${key}:`, err);
          }
        }
      });
    }

    // Import provider settings
    if (data.providers) {
      console.log('Importing provider settings:', Object.keys(data.providers));

      // Import provider_settings to localStorage
      if (data.providers.provider_settings) {
        try {
          safeSetItem('provider_settings', data.providers.provider_settings);
        } catch (err) {
          console.error('Error importing provider settings:', err);
        }
      }

      // Import API keys and other provider cookies
      const providerCookies = ['apiKeys', 'selectedModel', 'selectedProvider', 'providers'];
      providerCookies.forEach((key) => {
        if (data.providers[key]) {
          try {
            safeSetCookie(key, data.providers[key]);
          } catch (err) {
            console.error(`Error importing provider cookie ${key}:`, err);
          }
        }
      });
    }

    // Import feature settings
    if (data.features) {
      console.log('Importing feature settings:', Object.keys(data.features));
      Object.entries(data.features).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing feature setting ${key}:`, err);
          }
        }
      });
    }

    // Import UI configuration
    if (data.ui) {
      console.log('Importing UI configuration:', Object.keys(data.ui));

      // Import localStorage UI settings
      if (data.ui.bolt_tab_configuration) {
        try {
          safeSetItem('bolt_tab_configuration', data.ui.bolt_tab_configuration);
        } catch (err) {
          console.error('Error importing tab configuration:', err);
        }
      }

      if (data.ui.promptId) {
        try {
          safeSetItem('promptId', data.ui.promptId);
        } catch (err) {
          console.error('Error importing promptId:', err);
        }
      }

      // Import cookie UI settings
      if (data.ui.tabConfiguration) {
        try {
          safeSetCookie('tabConfiguration', data.ui.tabConfiguration);
        } catch (err) {
          console.error('Error importing tab configuration cookie:', err);
        }
      }

      if (data.ui.cachedPrompt) {
        try {
          safeSetCookie('cachedPrompt', data.ui.cachedPrompt);
        } catch (err) {
          console.error('Error importing cached prompt:', err);
        }
      }
    }

    // Import connections
    if (data.connections) {
      console.log('Importing connections:', Object.keys(data.connections));

      // Import netlify connection
      if (data.connections.netlify_connection) {
        try {
          safeSetItem('netlify_connection', data.connections.netlify_connection);
        } catch (err) {
          console.error('Error importing netlify connection:', err);
        }
      }

      // Import GitHub connections
      Object.entries(data.connections).forEach(([key, value]) => {
        if (key.startsWith('git:') && value !== null && value !== undefined) {
          try {
            safeSetCookie(key, value);
          } catch (err) {
            console.error(`Error importing GitHub connection ${key}:`, err);
          }
        }
      });
    }

    // Import debug settings
    if (data.debug) {
      console.log('Importing debug settings:', Object.keys(data.debug));

      // Import localStorage debug settings
      ['acknowledged_debug_issues', 'error_logs', 'bolt_read_logs'].forEach((key) => {
        if (data.debug[key]) {
          try {
            safeSetItem(key, data.debug[key]);
          } catch (err) {
            console.error(`Error importing debug setting ${key}:`, err);
          }
        }
      });

      // Import cookie debug settings
      ['isDebugEnabled', 'eventLogs'].forEach((key) => {
        if (data.debug[key]) {
          try {
            safeSetCookie(key, data.debug[key]);
          } catch (err) {
            console.error(`Error importing debug cookie ${key}:`, err);
          }
        }
      });
    }

    // Import update settings
    if (data.updates) {
      console.log('Importing update settings:', Object.keys(data.updates));
      Object.entries(data.updates).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing update setting ${key}:`, err);
          }
        }
      });
    }

    // Import chat snapshots
    if (data.chatSnapshots) {
      console.log('Importing chat snapshots:', Object.keys(data.chatSnapshots).length);
      Object.entries(data.chatSnapshots).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing chat snapshot ${key}:`, err);
          }
        }
      });
    }

    // If all else fails, try to import from raw data
    if (data._raw) {
      console.log('Attempting to import from raw data as fallback');

      // Import raw localStorage data
      if (data._raw.localStorage) {
        Object.entries(data._raw.localStorage).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            try {
              safeSetItem(key, value);
            } catch (err) {
              console.error(`Error importing raw localStorage ${key}:`, err);
            }
          }
        });
      }

      // Import raw cookie data
      if (data._raw.cookies) {
        Object.entries(data._raw.cookies).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            try {
              safeSetCookie(key, value);
            } catch (err) {
              console.error(`Error importing raw cookie ${key}:`, err);
            }
          }
        });
      }
    }
  };

  // Helper function to import legacy formats
  const importLegacyFormat = async (data: any) => {
    console.log('Importing using legacy format');

    // Handle the format with localStorage and cookies sections
    if (data.localStorage && typeof data.localStorage === 'object') {
      console.log('Importing localStorage settings from legacy format');

      // Import localStorage settings
      Object.entries(data.localStorage).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            safeSetItem(key, value);
          } catch (err) {
            console.error(`Error importing localStorage item ${key}:`, err);
          }
        }
      });
    }

    if (data.cookies && typeof data.cookies === 'object') {
      console.log('Importing cookie settings from legacy format');

      // Import cookie settings
      Object.entries(data.cookies).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          try {
            // Skip gitSettings as it's handled separately
            if (key !== 'gitSettings') {
              safeSetCookie(key, value);
            }
          } catch (err) {
            console.error(`Error importing cookie ${key}:`, err);
          }
        }
      });

      // Handle git settings separately
      if (data.cookies.gitSettings) {
        try {
          // Parse gitSettings if it's a string (it might be pre-stringified)
          const gitSettings =
            typeof data.cookies.gitSettings === 'string'
              ? JSON.parse(data.cookies.gitSettings)
              : data.cookies.gitSettings;

          console.log('Importing git settings from legacy format');

          Object.entries(gitSettings).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              try {
                safeSetCookie(key, value);
              } catch (err) {
                console.error(`Error importing git cookie ${key}:`, err);
              }
            }
          });
        } catch (err) {
          console.error('Error processing git settings:', err);
        }
      }
    }

    // Handle the oldest format (direct userProfile and settings)
    else if (data.userProfile || data.settings) {
      console.log('Importing using oldest format');

      // Handle old format
      if (data.userProfile) {
        try {
          safeSetItem('bolt_user_profile', data.userProfile);
        } catch (err) {
          console.error('Error importing user profile from oldest format:', err);
        }
      }

      if (data.settings) {
        try {
          safeSetItem('bolt_settings', data.settings);
        } catch (err) {
          console.error('Error importing settings from oldest format:', err);
        }
      }
    }
  };

  // Helper functions for import
  const safeSetItem = (key: string, value: any) => {
    try {
      const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
      console.log(`Setting localStorage[${key}]`);
      localStorage.setItem(key, valueToStore);
    } catch (err) {
      console.error(`Error setting localStorage item ${key}:`, err);
      throw err;
    }
  };

  const safeSetCookie = (key: string, value: any) => {
    try {
      const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
      console.log(`Setting cookie[${key}]`);
      Cookies.set(key, valueToStore, { expires: 30 });
    } catch (err) {
      console.error(`Error setting cookie ${key}:`, err);
      throw err;
    }
  };

  const handleImportAPIKeys = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsImportingKeys(true);

    try {
      const content = await file.text();
      const keys = JSON.parse(content);

      // Get existing keys from cookies
      const existingKeys = (() => {
        const storedApiKeys = Cookies.get('apiKeys');
        return storedApiKeys ? JSON.parse(storedApiKeys) : {};
      })();

      // Validate and save each key
      const newKeys = { ...existingKeys };
      Object.entries(keys).forEach(([key, value]) => {
        // Skip comment fields
        if (key.startsWith('_')) {
          return;
        }

        // Skip base URL fields (they should be set in .env.local)
        if (key.includes('_API_BASE_URL')) {
          return;
        }

        if (typeof value !== 'string') {
          throw new Error(`Invalid value for key: ${key}`);
        }

        // Handle both old and new template formats
        let normalizedKey = key;

        // Check if this is the old format (e.g., "Anthropic_API_KEY")
        if (key.includes('_API_KEY')) {
          // Extract the provider name from the old format
          normalizedKey = key.replace('_API_KEY', '');
        }

        /*
         * Only add non-empty keys
         * Use the normalized key in the correct format
         * (e.g., "OpenAI", "Google", "Anthropic")
         */
        if (value) {
          newKeys[normalizedKey] = value;
        }
      });

      // Save to cookies
      Cookies.set('apiKeys', JSON.stringify(newKeys));

      toast.success('API keys imported successfully');

      // Reload the page to apply the changes
      window.location.reload();
    } catch (error) {
      console.error('Error importing API keys:', error);
      toast.error('Failed to import API keys');
    } finally {
      setIsImportingKeys(false);

      if (apiKeyFileInputRef.current) {
        apiKeyFileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    setIsDownloadingTemplate(true);

    try {
      /*
       * Create a template with provider names as keys
       * This matches how the application stores API keys in cookies
       */
      const template = {
        Anthropic: '',
        OpenAI: '',
        Google: '',
        Groq: '',
        HuggingFace: '',
        OpenRouter: '',
        Deepseek: '',
        Mistral: '',
        OpenAILike: '',
        Together: '',
        xAI: '',
        Perplexity: '',
        Cohere: '',
        AzureOpenAI: '',
      };

      // Add a comment to explain the format
      const templateWithComment = {
        _comment:
          "Fill in your API keys for each provider. Keys will be stored with the provider name (e.g., 'OpenAI'). The application also supports the older format with keys like 'OpenAI_API_KEY' for backward compatibility.",
        ...template,
      };

      const blob = new Blob([JSON.stringify(templateWithComment, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bolt-api-keys-template.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Template downloaded successfully');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleResetSettings = async () => {
    setIsResetting(true);

    try {
      console.log('Starting complete settings reset');

      // 1. Clear all localStorage items related to application settings
      const localStorageKeysToPreserve: string[] = ['debug_mode']; // Keys to preserve if needed

      // Get all localStorage keys
      const allLocalStorageKeys = Object.keys(localStorage);
      console.log('Clearing localStorage items:', allLocalStorageKeys.length, 'items found');

      // Clear all localStorage items except those to preserve
      allLocalStorageKeys.forEach((key) => {
        if (!localStorageKeysToPreserve.includes(key)) {
          try {
            console.log(`Removing localStorage item: ${key}`);
            localStorage.removeItem(key);
          } catch (err) {
            console.error(`Error removing localStorage item ${key}:`, err);
          }
        }
      });

      // 2. Clear all cookies related to application settings
      const cookiesToPreserve: string[] = []; // Cookies to preserve if needed

      // Get all cookies
      const allCookies = Cookies.get();
      const cookieKeys = Object.keys(allCookies);
      console.log('Clearing cookies:', cookieKeys.length, 'items found');

      // Clear all cookies except those to preserve
      cookieKeys.forEach((key) => {
        if (!cookiesToPreserve.includes(key)) {
          try {
            console.log(`Removing cookie: ${key}`);
            Cookies.remove(key);
          } catch (err) {
            console.error(`Error removing cookie ${key}:`, err);
          }
        }
      });

      // 3. Clear all data from IndexedDB
      if (!db) {
        console.warn('Database not initialized, skipping IndexedDB reset');
      } else {
        console.log('Clearing IndexedDB data');

        // Get all chats and delete them
        const chats = await getAll(db as IDBDatabase);
        console.log(`Deleting ${chats.length} chats from IndexedDB`);

        const deletePromises = chats.map((chat) => deleteById(db as IDBDatabase, chat.id));
        await Promise.all(deletePromises);
      }

      // 4. Clear any chat snapshots
      const snapshotKeys = Object.keys(localStorage).filter((key) => key.startsWith('snapshot:'));
      console.log(`Clearing ${snapshotKeys.length} chat snapshots`);
      snapshotKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (err) {
          console.error(`Error removing snapshot ${key}:`, err);
        }
      });

      console.log('Settings reset completed successfully');

      // Close the dialog first
      setShowResetInlineConfirm(false);

      // Show success message and reload
      toast.success('All settings have been reset to default values');

      // Use setTimeout to ensure the toast is shown before reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Reset error:', error);
      setShowResetInlineConfirm(false);
      toast.error('Failed to reset settings: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAllChats = async () => {
    setIsDeleting(true);

    try {
      // Clear chat history from localStorage
      localStorage.removeItem('bolt_chat_history');

      // Clear chats from IndexedDB
      if (!db) {
        throw new Error('Database not initialized');
      }

      // Get all chats and delete them one by one
      const chats = await getAll(db as IDBDatabase);
      const deletePromises = chats.map((chat) => deleteById(db as IDBDatabase, chat.id));
      await Promise.all(deletePromises);

      // Close the dialog first
      setShowDeleteInlineConfirm(false);

      // Then show the success message
      toast.success('Chat history deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      setShowDeleteInlineConfirm(false);
      toast.error('Failed to delete chat history');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportSettings} className="hidden" />
      {/* Reset Settings Dialog */}
      <DialogRoot open={showResetInlineConfirm} onOpenChange={setShowResetInlineConfirm}>
        <Dialog showCloseButton={false} className="z-[1000]">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="i-ph:warning-circle-fill w-5 h-5 text-yellow-500" />
              <DialogTitle>Reset All Settings?</DialogTitle>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary mt-2">
              This will reset all your settings to their default values. This action cannot be undone.
            </p>
            <div className="flex justify-end items-center gap-3 mt-6">
              <DialogClose asChild>
                <button className="px-4 py-2 rounded-lg text-sm bg-[#F5F5F5] dark:bg-[#1A1A1A] text-[#666666] dark:text-[#999999] hover:text-[#333333] dark:hover:text-white">
                  Cancel
                </button>
              </DialogClose>
              <motion.button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white dark:bg-[#1A1A1A] text-yellow-600 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-500/10 border border-transparent hover:border-yellow-500/10 dark:hover:border-yellow-500/20"
                onClick={handleResetSettings}
                disabled={isResetting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isResetting ? (
                  <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
                ) : (
                  <div className="i-ph:arrow-counter-clockwise w-4 h-4" />
                )}
                Reset Settings
              </motion.button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot open={showDeleteInlineConfirm} onOpenChange={setShowDeleteInlineConfirm}>
        <Dialog showCloseButton={false} className="z-[1000]">
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="i-ph:warning-circle-fill w-5 h-5 text-red-500" />
              <DialogTitle>Delete All Chats?</DialogTitle>
            </div>
            <p className="text-sm text-bolt-elements-textSecondary mt-2">
              This will permanently delete all your chat history. This action cannot be undone.
            </p>
            <div className="flex justify-end items-center gap-3 mt-6">
              <DialogClose asChild>
                <button className="px-4 py-2 rounded-lg text-sm bg-[#F5F5F5] dark:bg-[#1A1A1A] text-[#666666] dark:text-[#999999] hover:text-[#333333] dark:hover:text-white">
                  Cancel
                </button>
              </DialogClose>
              <motion.button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white dark:bg-[#1A1A1A] text-red-500 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-500/10 dark:hover:border-red-500/20"
                onClick={handleDeleteAllChats}
                disabled={isDeleting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {isDeleting ? (
                  <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
                ) : (
                  <div className="i-ph:trash w-4 h-4" />
                )}
                Delete All
              </motion.button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Chat History Section */}
      <motion.div
        className="bg-white dark:bg-[#0A0A0A] rounded-lg p-6 border border-[#E5E5E5] dark:border-[#1A1A1A]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:chat-circle-duotone w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Chat History</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Export or delete all your chat history.</p>
        <div className="flex gap-4">
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportAllChats}
          >
            <div className="i-ph:download-simple w-4 h-4" />
            Export All Chats
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 text-red-500 text-sm hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDeleteInlineConfirm(true)}
          >
            <div className="i-ph:trash w-4 h-4" />
            Delete All Chats
          </motion.button>
        </div>
      </motion.div>

      {/* Settings Backup Section */}
      <motion.div
        className="bg-white dark:bg-[#0A0A0A] rounded-lg p-6 border border-[#E5E5E5] dark:border-[#1A1A1A]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:gear-duotone w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Settings Backup</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Export your settings to a JSON file or import settings from a previously exported file.
        </p>
        <div className="flex gap-4">
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportSettings}
          >
            <div className="i-ph:download-simple w-4 h-4" />
            Export Settings
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="i-ph:upload-simple w-4 h-4" />
            Import Settings
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-50 text-yellow-600 text-sm hover:bg-yellow-100 dark:bg-yellow-500/10 dark:hover:bg-yellow-500/20 dark:text-yellow-500"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowResetInlineConfirm(true)}
          >
            <div className="i-ph:arrow-counter-clockwise w-4 h-4" />
            Reset Settings
          </motion.button>
        </div>
      </motion.div>

      {/* API Keys Management Section */}
      <motion.div
        className="bg-white dark:bg-[#0A0A0A] rounded-lg p-6 border border-[#E5E5E5] dark:border-[#1A1A1A]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="i-ph:key-duotone w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">API Keys Management</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Import API keys from a JSON file or download a template to fill in your keys.
        </p>
        <div className="flex gap-4">
          <input
            ref={apiKeyFileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportAPIKeys}
            className="hidden"
          />
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
          >
            {isDownloadingTemplate ? (
              <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
            ) : (
              <div className="i-ph:download-simple w-4 h-4" />
            )}
            Download Template
          </motion.button>
          <motion.button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => apiKeyFileInputRef.current?.click()}
            disabled={isImportingKeys}
          >
            {isImportingKeys ? (
              <div className="i-ph:spinner-gap-bold animate-spin w-4 h-4" />
            ) : (
              <div className="i-ph:upload-simple w-4 h-4" />
            )}
            Import API Keys
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// Helper functions for export
const safeGetItem = (key: string): any => {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return null;
    }

    // Try to parse as JSON, fall back to raw value
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (err) {
    console.error(`Error getting ${key} from localStorage:`, err);
    return null;
  }
};

const getAllLocalStorage = (): Record<string, any> => {
  const result: Record<string, any> = {};

  try {
    Object.keys(localStorage).forEach((key) => {
      try {
        const value = localStorage.getItem(key);

        if (value) {
          try {
            result[key] = JSON.parse(value);
          } catch {
            result[key] = value;
          }
        }
      } catch (err) {
        console.error(`Error processing localStorage key ${key}:`, err);
      }
    });
  } catch (err) {
    console.error('Error getting all localStorage items:', err);
  }

  return result;
};

const getGitHubConnections = (cookies: Record<string, string>): Record<string, any> => {
  const gitConnections: Record<string, any> = {};

  Object.keys(cookies).forEach((key) => {
    if (key.startsWith('git:')) {
      try {
        gitConnections[key] = JSON.parse(cookies[key]);
      } catch {
        gitConnections[key] = cookies[key];
      }
    }
  });

  return gitConnections;
};

const getChatSnapshots = (): Record<string, any> => {
  const snapshots: Record<string, any> = {};

  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('snapshot:')) {
        try {
          const value = localStorage.getItem(key);

          if (value) {
            snapshots[key] = JSON.parse(value);
          }
        } catch (err) {
          console.error(`Error processing snapshot ${key}:`, err);
        }
      }
    });
  } catch (err) {
    console.error('Error getting chat snapshots:', err);
  }

  return snapshots;
};

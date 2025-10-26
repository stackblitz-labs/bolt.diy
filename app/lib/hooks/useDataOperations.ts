import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { ImportExportService } from '~/lib/services/importExportService';
import { useIndexedDB } from '~/lib/hooks/useIndexedDB';
import { generateId } from 'ai';

interface UseDataOperationsProps {
  /**
   * Callback to reload settings after import
   */
  onReloadSettings?: () => void;

  /**
   * Callback to reload chats after import
   */
  onReloadChats?: () => void;

  /**
   * Callback to reset settings to defaults
   */
  onResetSettings?: () => void;

  /**
   * Callback to reset chats
   */
  onResetChats?: () => void;

  /**
   * Custom database instance (optional)
   */
  customDb?: IDBDatabase;
}

/**
 * Hook for managing data operations in the DataTab
 */
export function useDataOperations({
  onReloadSettings,
  onReloadChats,
  onResetSettings,
  onResetChats,
  customDb,
}: UseDataOperationsProps = {}) {
  const { db: defaultDb } = useIndexedDB();

  // Use the custom database if provided, otherwise use the default
  const db = customDb || defaultDb;
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [lastOperation, setLastOperation] = useState<{ type: string; data: any } | null>(null);

  /**
   * Show progress toast with percentage
   */
  const showProgress = useCallback((message: string, percent: number) => {
    setProgressMessage(message);
    setProgressPercent(percent);

    // Dismiss any existing progress toast before showing a new one
    toast.dismiss('progress-toast');

    toast.loading(`${message} (${percent}%)`, {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast', // Use the same ID for all progress messages
    });
  }, []);

  /**
   * Export all settings to a JSON file
   */
  const handleExportSettings = useCallback(async () => {
    setIsExporting(true);
    setProgressPercent(0);

    // Dismiss any existing toast first
    toast.dismiss('progress-toast');

    toast.loading('Preparing settings export...', {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast',
    });

    try {
      // Step 1: Export settings
      showProgress('Exporting settings', 25);

      const settingsData = await ImportExportService.exportSettings();

      // Step 2: Create blob
      showProgress('Creating file', 50);

      const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
        type: 'application/json',
      });

      // Step 3: Download file
      showProgress('Downloading file', 75);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bolt-settings.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Step 4: Complete
      showProgress('Completing export', 100);

      // Dismiss progress toast before showing success toast
      toast.dismiss('progress-toast');

      toast.success('Settings exported successfully', {
        position: 'bottom-right',
        autoClose: 3000,
      });

      // Save operation for potential undo
      setLastOperation({ type: 'export-settings', data: settingsData });
    } catch (error) {
      console.error('Error exporting settings:', error);

      // Dismiss progress toast before showing error toast
      toast.dismiss('progress-toast');

      toast.error(`Failed to export settings: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
    } finally {
      setIsExporting(false);
      setProgressPercent(0);
      setProgressMessage('');
    }
  }, [showProgress]);

  /**
   * Export selected settings categories to a JSON file
   * @param categoryIds Array of category IDs to export
   */
  const handleExportSelectedSettings = useCallback(
    async (categoryIds: string[]) => {
      if (!categoryIds || categoryIds.length === 0) {
        toast.error('No settings categories selected', {
          position: 'bottom-right',
          autoClose: 3000,
        });
        return;
      }

      setIsExporting(true);
      setProgressPercent(0);

      // Dismiss any existing toast first
      toast.dismiss('progress-toast');

      toast.loading(`Preparing export of ${categoryIds.length} settings categories...`, {
        position: 'bottom-right',
        autoClose: 3000,
        toastId: 'progress-toast',
      });

      try {
        // Step 1: Export all settings
        showProgress('Exporting settings', 20);

        const allSettings = await ImportExportService.exportSettings();

        // Step 2: Filter settings by category
        showProgress('Filtering selected categories', 40);

        const filteredSettings: Record<string, any> = {
          exportDate: allSettings.exportDate,
        };

        // Add selected categories to filtered settings
        categoryIds.forEach((category) => {
          if (allSettings[category]) {
            filteredSettings[category] = allSettings[category];
          }
        });

        // Step 3: Create blob
        showProgress('Creating file', 60);

        const blob = new Blob([JSON.stringify(filteredSettings, null, 2)], {
          type: 'application/json',
        });

        // Step 4: Download file
        showProgress('Downloading file', 80);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bolt-settings-${categoryIds.join('-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Step 5: Complete
        showProgress('Completing export', 100);

        // Dismiss progress toast before showing success toast
        toast.dismiss('progress-toast');

        toast.success(`${categoryIds.length} settings categories exported successfully`, {
          position: 'bottom-right',
          autoClose: 3000,
        });

        // Save operation for potential undo
        setLastOperation({
          type: 'export-selected-settings',
          data: { settings: filteredSettings, categories: categoryIds },
        });
      } catch (error) {
        console.error('Error exporting selected settings:', error);

        // Dismiss progress toast before showing error toast
        toast.dismiss('progress-toast');

        toast.error(`Failed to export settings: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });
      } finally {
        setIsExporting(false);
        setProgressPercent(0);
        setProgressMessage('');
      }
    },
    [showProgress],
  );

  /**
   * Export all chats to a JSON file
   */
  const handleExportAllChats = useCallback(async () => {
    if (!db) {
      toast.error('Database not available', {
        position: 'bottom-right',
        autoClose: 3000,
      });
      return;
    }

    console.log('Export: Using database', {
      name: db.name,
      version: db.version,
      objectStoreNames: Array.from(db.objectStoreNames),
    });

    setIsExporting(true);
    setProgressPercent(0);

    // Dismiss any existing toast first
    toast.dismiss('progress-toast');

    toast.loading('Preparing chats export...', {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast',
    });

    try {
      // Step 1: Export chats
      showProgress('Retrieving chats from database', 25);

      console.log('Database details:', {
        name: db.name,
        version: db.version,
        objectStoreNames: Array.from(db.objectStoreNames),
      });

      // Direct database query approach for more reliable access
      const directChats = await new Promise<any[]>((resolve, reject) => {
        try {
          console.log(`Creating transaction on '${db.name}' database, objectStore 'chats'`);

          const transaction = db.transaction(['chats'], 'readonly');
          const store = transaction.objectStore('chats');
          const request = store.getAll();

          request.onsuccess = () => {
            console.log(`Found ${request.result ? request.result.length : 0} chats directly from database`);
            resolve(request.result || []);
          };

          request.onerror = () => {
            console.error('Error querying chats store:', request.error);
            reject(request.error);
          };
        } catch (err) {
          console.error('Error creating transaction:', err);
          reject(err);
        }
      });

      // Export data with direct chats
      const exportData = {
        chats: directChats,
        exportDate: new Date().toISOString(),
      };

      console.log(`Preparing to export ${exportData.chats.length} chats`);

      // Step 2: Create blob
      showProgress('Creating file', 50);

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      // Step 3: Download file
      showProgress('Downloading file', 75);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bolt-chats.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Step 4: Complete
      showProgress('Completing export', 100);

      // Dismiss progress toast before showing success toast
      toast.dismiss('progress-toast');

      toast.success(`${exportData.chats.length} chats exported successfully`, {
        position: 'bottom-right',
        autoClose: 3000,
      });

      // Save operation for potential undo
      setLastOperation({ type: 'export-chats', data: exportData });
    } catch (error) {
      console.error('Error exporting chats:', error);

      // Dismiss progress toast before showing error toast
      toast.dismiss('progress-toast');

      toast.error(`Failed to export chats: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
    } finally {
      setIsExporting(false);
      setProgressPercent(0);
      setProgressMessage('');
    }
  }, [db, showProgress]);

  /**
   * Export selected chats to a JSON file
   * @param chatIds Array of chat IDs to export
   */
  const handleExportSelectedChats = useCallback(
    async (chatIds: string[]) => {
      if (!db) {
        toast.error('Database not available', {
          position: 'bottom-right',
          autoClose: 3000,
        });
        return;
      }

      if (!chatIds || chatIds.length === 0) {
        toast.error('No chats selected', {
          position: 'bottom-right',
          autoClose: 3000,
        });
        return;
      }

      setIsExporting(true);
      setProgressPercent(0);

      // Dismiss any existing toast first
      toast.dismiss('progress-toast');

      toast.loading(`Preparing export of ${chatIds.length} chats...`, {
        position: 'bottom-right',
        autoClose: 3000,
        toastId: 'progress-toast',
      });

      try {
        // Step 1: Get chats from database
        showProgress('Retrieving chats from database', 25);

        const transaction = db.transaction(['chats'], 'readonly');
        const store = transaction.objectStore('chats');

        // Create an array to store the promises for getting each chat
        const chatPromises = chatIds.map((chatId) => {
          return new Promise<any>((resolve, reject) => {
            const request = store.get(chatId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        });

        // Wait for all promises to resolve
        const chats = await Promise.all(chatPromises);
        const filteredChats = chats.filter(Boolean); // Remove any null/undefined results

        console.log(`Retrieved ${filteredChats.length} chats for export`);

        // Create export data
        const exportData = {
          chats: filteredChats,
          exportDate: new Date().toISOString(),
        };

        // Step 2: Create blob
        showProgress('Creating file', 50);

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });

        // Step 3: Download file
        showProgress('Downloading file', 75);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bolt-selected-chats.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Step 4: Complete
        showProgress('Completing export', 100);

        // Dismiss progress toast before showing success toast
        toast.dismiss('progress-toast');

        toast.success(`${filteredChats.length} chats exported successfully`, {
          position: 'bottom-right',
          autoClose: 3000,
        });

        // Save operation for potential undo
        setLastOperation({ type: 'export-selected-chats', data: { chatIds, chats: filteredChats } });
      } catch (error) {
        console.error('Error exporting selected chats:', error);

        // Dismiss progress toast before showing error toast
        toast.dismiss('progress-toast');

        toast.error(`Failed to export selected chats: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });
      } finally {
        setIsExporting(false);
        setProgressPercent(0);
        setProgressMessage('');
      }
    },
    [db, showProgress],
  );

  /**
   * Import settings from a JSON file
   * @param file The file to import
   */
  const handleImportSettings = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setProgressPercent(0);

      // Dismiss any existing toast first
      toast.dismiss('progress-toast');

      toast.loading(`Importing settings from ${file.name}...`, {
        position: 'bottom-right',
        autoClose: 3000,
        toastId: 'progress-toast',
      });

      try {
        // Step 1: Read file
        showProgress('Reading file', 20);

        const fileContent = await file.text();

        // Step 2: Parse JSON
        showProgress('Parsing settings data', 40);

        const importedData = JSON.parse(fileContent);

        // Step 3: Validate data
        showProgress('Validating settings data', 60);

        // Save current settings for potential undo
        const currentSettings = await ImportExportService.exportSettings();
        setLastOperation({ type: 'import-settings', data: { previous: currentSettings } });

        // Step 4: Import settings
        showProgress('Applying settings', 80);
        await ImportExportService.importSettings(importedData);

        // Step 5: Complete
        showProgress('Completing import', 100);

        // Dismiss progress toast before showing success toast
        toast.dismiss('progress-toast');

        toast.success('Settings imported successfully', {
          position: 'bottom-right',
          autoClose: 3000,
        });

        if (onReloadSettings) {
          onReloadSettings();
        }
      } catch (error) {
        console.error('Error importing settings:', error);

        // Dismiss progress toast before showing error toast
        toast.dismiss('progress-toast');

        toast.error(`Failed to import settings: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });
      } finally {
        setIsImporting(false);
        setProgressPercent(0);
        setProgressMessage('');
      }
    },
    [onReloadSettings, showProgress],
  );

  /**
   * Import chats from a JSON file
   * @param file The file to import
   */
  const handleImportChats = useCallback(
    async (file: File) => {
      if (!db) {
        toast.error('Database not available', {
          position: 'bottom-right',
          autoClose: 3000,
        });
        return;
      }

      setIsImporting(true);
      setProgressPercent(0);

      // Dismiss any existing toast first
      toast.dismiss('progress-toast');

      toast.loading(`Importing chats from ${file.name}...`, {
        position: 'bottom-right',
        autoClose: 3000,
        toastId: 'progress-toast',
      });

      try {
        // Step 1: Read file
        showProgress('Reading file', 20);

        const fileContent = await file.text();

        // Step 2: Parse JSON and validate structure
        showProgress('Parsing chat data', 40);

        const importedData = JSON.parse(fileContent);

        if (!importedData.chats || !Array.isArray(importedData.chats)) {
          throw new Error('Invalid chat data format: missing or invalid chats array');
        }

        // Step 3: Validate each chat object
        showProgress('Validating chat data', 60);

        const validatedChats = importedData.chats.map((chat: any) => {
          if (!chat.id || !Array.isArray(chat.messages)) {
            throw new Error('Invalid chat format: missing required fields');
          }

          // Ensure each message has required fields
          const validatedMessages = chat.messages.map((msg: any) => {
            if (!msg.role || !msg.content) {
              throw new Error('Invalid message format: missing required fields');
            }

            return {
              id: msg.id || generateId(),
              role: msg.role,
              content: msg.content,
              name: msg.name,
              function_call: msg.function_call,
              timestamp: msg.timestamp || Date.now(),
            };
          });

          return {
            id: chat.id,
            description: chat.description || '',
            messages: validatedMessages,
            timestamp: chat.timestamp || new Date().toISOString(),
            urlId: chat.urlId || null,
            metadata: chat.metadata || null,
          };
        });

        // Step 4: Save current chats for potential undo
        showProgress('Preparing database transaction', 70);

        const currentChats = await ImportExportService.exportAllChats(db);
        setLastOperation({ type: 'import-chats', data: { previous: currentChats } });

        // Step 5: Import chats
        showProgress(`Importing ${validatedChats.length} chats`, 80);

        const transaction = db.transaction(['chats'], 'readwrite');
        const store = transaction.objectStore('chats');

        let processed = 0;

        for (const chat of validatedChats) {
          store.put(chat);
          processed++;

          if (processed % 5 === 0 || processed === validatedChats.length) {
            showProgress(
              `Imported ${processed} of ${validatedChats.length} chats`,
              80 + (processed / validatedChats.length) * 20,
            );
          }
        }

        await new Promise((resolve, reject) => {
          transaction.oncomplete = resolve;
          transaction.onerror = reject;
        });

        // Step 6: Complete
        showProgress('Completing import', 100);

        // Dismiss progress toast before showing success toast
        toast.dismiss('progress-toast');

        toast.success(`${validatedChats.length} chats imported successfully`, {
          position: 'bottom-right',
          autoClose: 3000,
        });

        if (onReloadChats) {
          onReloadChats();
        }
      } catch (error) {
        console.error('Error importing chats:', error);

        // Dismiss progress toast before showing error toast
        toast.dismiss('progress-toast');

        toast.error(`Failed to import chats: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });
      } finally {
        setIsImporting(false);
        setProgressPercent(0);
        setProgressMessage('');
      }
    },
    [db, onReloadChats, showProgress],
  );

  /**
   * Import API keys from a JSON file
   * @param file The file to import
   */
  const handleImportAPIKeys = useCallback(
    async (file: File) => {
      setIsImporting(true);
      setProgressPercent(0);

      // Dismiss any existing toast first
      toast.dismiss('progress-toast');

      toast.loading(`Importing API keys from ${file.name}...`, {
        position: 'bottom-right',
        autoClose: 3000,
        toastId: 'progress-toast',
      });

      try {
        // Step 1: Read file
        showProgress('Reading file', 20);

        const fileContent = await file.text();

        // Step 2: Parse JSON
        showProgress('Parsing API keys data', 40);

        const importedData = JSON.parse(fileContent);

        // Step 3: Validate data
        showProgress('Validating API keys data', 60);

        // Get current API keys from cookies for potential undo
        const apiKeysStr = document.cookie.split(';').find((row) => row.trim().startsWith('apiKeys='));
        const currentApiKeys = apiKeysStr ? JSON.parse(decodeURIComponent(apiKeysStr.split('=')[1])) : {};
        setLastOperation({ type: 'import-api-keys', data: { previous: currentApiKeys } });

        // Step 4: Import API keys
        showProgress('Applying API keys', 80);

        const newKeys = ImportExportService.importAPIKeys(importedData);
        const apiKeysJson = JSON.stringify(newKeys);
        document.cookie = `apiKeys=${apiKeysJson}; path=/; max-age=31536000`;

        // Step 5: Complete
        showProgress('Completing import', 100);

        // Dismiss progress toast before showing success toast
        toast.dismiss('progress-toast');

        // Count how many keys were imported
        const keyCount = Object.keys(newKeys).length;
        const newKeyCount = Object.keys(newKeys).filter(
          (key) => !currentApiKeys[key] || currentApiKeys[key] !== newKeys[key],
        ).length;

        toast.success(
          `${keyCount} API keys imported successfully (${newKeyCount} new/updated)\n` +
            'Note: Keys are stored in browser cookies. For server-side usage, add them to your .env.local file.',
          { position: 'bottom-right', autoClose: 5000 },
        );

        if (onReloadSettings) {
          onReloadSettings();
        }
      } catch (error) {
        console.error('Error importing API keys:', error);

        // Dismiss progress toast before showing error toast
        toast.dismiss('progress-toast');

        toast.error(`Failed to import API keys: ${error instanceof Error ? error.message : 'Unknown error'}`, {
          position: 'bottom-right',
          autoClose: 3000,
        });
      } finally {
        setIsImporting(false);
        setProgressPercent(0);
        setProgressMessage('');
      }
    },
    [onReloadSettings, showProgress],
  );

  /**
   * Reset all settings to default values
   */
  const handleResetSettings = useCallback(async () => {
    setIsResetting(true);
    setProgressPercent(0);

    // Dismiss any existing toast first
    toast.dismiss('progress-toast');

    toast.loading('Resetting settings...', {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast',
    });

    try {
      if (db) {
        // Step 1: Save current settings for potential undo
        showProgress('Backing up current settings', 25);

        const currentSettings = await ImportExportService.exportSettings();
        setLastOperation({ type: 'reset-settings', data: { previous: currentSettings } });

        // Step 2: Reset settings
        showProgress('Resetting settings to defaults', 50);
        await ImportExportService.resetAllSettings(db);

        // Step 3: Complete
        showProgress('Completing reset', 100);

        // Dismiss progress toast before showing success toast
        toast.dismiss('progress-toast');

        toast.success('Settings reset successfully', {
          position: 'bottom-right',
          autoClose: 3000,
        });

        if (onResetSettings) {
          onResetSettings();
        }
      } else {
        // Dismiss progress toast before showing error toast
        toast.dismiss('progress-toast');

        toast.error('Database not available', {
          position: 'bottom-right',
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error('Error resetting settings:', error);

      // Dismiss progress toast before showing error toast
      toast.dismiss('progress-toast');

      toast.error(`Failed to reset settings: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
    } finally {
      setIsResetting(false);
      setProgressPercent(0);
      setProgressMessage('');
    }
  }, [db, onResetSettings, showProgress]);

  /**
   * Reset all chats
   */
  const handleResetChats = useCallback(async () => {
    if (!db) {
      toast.error('Database not available', {
        position: 'bottom-right',
        autoClose: 3000,
      });
      return;
    }

    setIsResetting(true);
    setProgressPercent(0);

    // Dismiss any existing toast first
    toast.dismiss('progress-toast');

    toast.loading('Deleting all chats...', {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast',
    });

    try {
      // Step 1: Save current chats for potential undo
      showProgress('Backing up current chats', 25);

      const currentChats = await ImportExportService.exportAllChats(db);
      setLastOperation({ type: 'reset-chats', data: { previous: currentChats } });

      // Step 2: Delete chats
      showProgress('Deleting chats from database', 50);
      await ImportExportService.deleteAllChats(db);

      // Step 3: Complete
      showProgress('Completing deletion', 100);

      // Dismiss progress toast before showing success toast
      toast.dismiss('progress-toast');

      toast.success('All chats deleted successfully', {
        position: 'bottom-right',
        autoClose: 3000,
      });

      if (onResetChats) {
        onResetChats();
      }
    } catch (error) {
      console.error('Error resetting chats:', error);

      // Dismiss progress toast before showing error toast
      toast.dismiss('progress-toast');

      toast.error(`Failed to delete chats: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
    } finally {
      setIsResetting(false);
      setProgressPercent(0);
      setProgressMessage('');
    }
  }, [db, onResetChats, showProgress]);

  /**
   * Download API keys template
   */
  const handleDownloadTemplate = useCallback(async () => {
    setIsDownloadingTemplate(true);
    setProgressPercent(0);

    // Dismiss any existing toast first
    toast.dismiss('progress-toast');

    toast.loading('Creating API keys template...', {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast',
    });

    try {
      // Step 1: Create template
      showProgress('Creating template', 50);

      const templateData = ImportExportService.createAPIKeysTemplate();

      // Step 2: Download file
      showProgress('Downloading template', 75);

      const blob = new Blob([JSON.stringify(templateData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bolt-api-keys-template.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Step 3: Complete
      showProgress('Completing download', 100);

      // Dismiss progress toast before showing success toast
      toast.dismiss('progress-toast');

      toast.success('Template downloaded successfully', {
        position: 'bottom-right',
        autoClose: 3000,
      });
    } catch (error) {
      console.error('Error downloading template:', error);

      // Dismiss progress toast before showing error toast
      toast.dismiss('progress-toast');

      toast.error(`Failed to download template: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
    } finally {
      setIsDownloadingTemplate(false);
      setProgressPercent(0);
      setProgressMessage('');
    }
  }, [showProgress]);

  /**
   * Export API keys to a JSON file
   */
  const handleExportAPIKeys = useCallback(async () => {
    setIsExporting(true);
    setProgressPercent(0);

    // Dismiss any existing toast first
    toast.dismiss('progress-toast');

    toast.loading('Exporting API keys...', {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast',
    });

    try {
      // Step 1: Get API keys from all sources
      showProgress('Retrieving API keys', 25);

      // Create a fetch request to get API keys from server
      const response = await fetch('/api/export-api-keys');

      if (!response.ok) {
        throw new Error('Failed to retrieve API keys from server');
      }

      const apiKeys = await response.json();

      // Step 2: Create blob
      showProgress('Creating file', 50);

      const blob = new Blob([JSON.stringify(apiKeys, null, 2)], {
        type: 'application/json',
      });

      // Step 3: Download file
      showProgress('Downloading file', 75);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bolt-api-keys.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Step 4: Complete
      showProgress('Completing export', 100);

      // Dismiss progress toast before showing success toast
      toast.dismiss('progress-toast');

      toast.success('API keys exported successfully', {
        position: 'bottom-right',
        autoClose: 3000,
      });

      // Save operation for potential undo
      setLastOperation({ type: 'export-api-keys', data: apiKeys });
    } catch (error) {
      console.error('Error exporting API keys:', error);

      // Dismiss progress toast before showing error toast
      toast.dismiss('progress-toast');

      toast.error(`Failed to export API keys: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
    } finally {
      setIsExporting(false);
      setProgressPercent(0);
      setProgressMessage('');
    }
  }, [showProgress]);

  /**
   * Undo the last operation if possible
   */
  const handleUndo = useCallback(async () => {
    if (!lastOperation || !db) {
      toast.error('Nothing to undo', {
        position: 'bottom-right',
        autoClose: 3000,
      });
      return;
    }

    // Dismiss any existing toast first
    toast.dismiss('progress-toast');

    toast.loading('Processing undo operation...', {
      position: 'bottom-right',
      autoClose: 3000,
      toastId: 'progress-toast',
    });

    try {
      switch (lastOperation.type) {
        case 'import-settings': {
          // Restore previous settings
          await ImportExportService.importSettings(lastOperation.data.previous);

          // Dismiss progress toast before showing success toast
          toast.dismiss('progress-toast');

          toast.success('Operation undone successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          if (onReloadSettings) {
            onReloadSettings();
          }

          break;
        }

        case 'import-chats': {
          // Delete imported chats and restore previous state
          await ImportExportService.deleteAllChats(db);

          // Reimport previous chats
          const transaction = db.transaction(['chats'], 'readwrite');
          const store = transaction.objectStore('chats');

          for (const chat of lastOperation.data.previous.chats) {
            store.put(chat);
          }

          await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
          });

          // Dismiss progress toast before showing success toast
          toast.dismiss('progress-toast');

          toast.success('Operation undone successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          if (onReloadChats) {
            onReloadChats();
          }

          break;
        }

        case 'reset-settings': {
          // Restore previous settings
          await ImportExportService.importSettings(lastOperation.data.previous);

          // Dismiss progress toast before showing success toast
          toast.dismiss('progress-toast');

          toast.success('Operation undone successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          if (onReloadSettings) {
            onReloadSettings();
          }

          break;
        }

        case 'reset-chats': {
          // Restore previous chats
          const chatTransaction = db.transaction(['chats'], 'readwrite');
          const chatStore = chatTransaction.objectStore('chats');

          for (const chat of lastOperation.data.previous.chats) {
            chatStore.put(chat);
          }

          await new Promise((resolve, reject) => {
            chatTransaction.oncomplete = resolve;
            chatTransaction.onerror = reject;
          });

          // Dismiss progress toast before showing success toast
          toast.dismiss('progress-toast');

          toast.success('Operation undone successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          if (onReloadChats) {
            onReloadChats();
          }

          break;
        }

        case 'import-api-keys': {
          // Restore previous API keys
          const previousAPIKeys = lastOperation.data.previous;
          const newKeys = ImportExportService.importAPIKeys(previousAPIKeys);
          const apiKeysJson = JSON.stringify(newKeys);
          document.cookie = `apiKeys=${apiKeysJson}; path=/; max-age=31536000`;

          // Dismiss progress toast before showing success toast
          toast.dismiss('progress-toast');

          toast.success('Operation undone successfully', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          if (onReloadSettings) {
            onReloadSettings();
          }

          break;
        }

        default:
          // Dismiss progress toast before showing error toast
          toast.dismiss('progress-toast');

          toast.error('Cannot undo this operation', {
            position: 'bottom-right',
            autoClose: 3000,
          });
      }

      // Clear the last operation after undoing
      setLastOperation(null);
    } catch (error) {
      console.error('Error undoing operation:', error);

      // Dismiss progress toast before showing error toast
      toast.dismiss('progress-toast');

      toast.error(`Failed to undo: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        position: 'bottom-right',
        autoClose: 3000,
      });
    }
  }, [lastOperation, db, onReloadSettings, onReloadChats]);

  return {
    isExporting,
    isImporting,
    isResetting,
    isDownloadingTemplate,
    progressMessage,
    progressPercent,
    lastOperation,
    handleExportSettings,
    handleExportSelectedSettings,
    handleExportAllChats,
    handleExportSelectedChats,
    handleImportSettings,
    handleImportChats,
    handleImportAPIKeys,
    handleResetSettings,
    handleResetChats,
    handleDownloadTemplate,
    handleExportAPIKeys,
    handleUndo,
  };
}

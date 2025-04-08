import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '~/components/ui/use-toast';
import OllamaModelsList from './OllamaModelsList';
import type { OllamaModelsListRef } from './OllamaModelsList';
import OllamaModelLibrary from './OllamaModelLibrary';
import { Button } from '~/components/ui/Button';

// Add the storage key for pending installations
const STORAGE_KEY = 'ollama-pending-installations';

// Interface for pending installations in storage
interface PendingInstallation {
  name: string;
  type: 'install' | 'update';
  startedAt: number;
}

interface OllamaModelInstallerProps {
  baseUrl: string;
  isConnected: boolean;
  onModelInstalled?: () => void;
}

interface ProgressState {
  percent: number;
  current: number | string;
  total: number | string;
  status: string;
}

export default function OllamaModelInstaller({ baseUrl, isConnected, onModelInstalled }: OllamaModelInstallerProps) {
  // Create refs to access component methods
  const modelsListRef = useRef<OllamaModelsListRef | null>(null);
  const { toast } = useToast();

  /*
   * State variables for tracking installation progress
   * These are used within handleModelAction but not directly in the JSX
   */
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [installStatus, setInstallStatus] = useState<'installing' | 'success' | 'error' | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [installError, setInstallError] = useState<string | null>(null);
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  const [progress, setProgress] = useState<ProgressState>({
    percent: 0,
    current: 0,
    total: 0,
    status: '',
  });

  // Track pending installations to display in UI
  const [pendingInstallations, setPendingInstallations] = useState<PendingInstallation[]>([]);

  // Load pending installations on mount
  useEffect(() => {
    const loadPendingInstallations = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const items = stored ? (JSON.parse(stored) as PendingInstallation[]) : [];

        // Filter out installations that are more than 24 hours old
        const now = Date.now();
        const filteredItems = items.filter((item) => {
          const isRecent = now - item.startedAt < 24 * 60 * 60 * 1000; // 24 hours

          if (!isRecent) {
            console.log(
              `Removing stale installation of ${item.name} from ${new Date(item.startedAt).toLocaleString()}`,
            );
          }

          return isRecent;
        });

        // If we filtered some out, update the storage
        if (filteredItems.length !== items.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredItems));
        }

        setPendingInstallations(filteredItems);
      } catch (err) {
        console.error('Error loading pending installations:', err);
        setPendingInstallations([]);
      }
    };

    loadPendingInstallations();

    // Set up interval to periodically refresh pending installations
    const intervalId = setInterval(loadPendingInstallations, 30000); // Every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Function to clear all pending installations
  const clearAllPendingInstallations = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      setPendingInstallations([]);
      toast('All pending installations cleared');
    } catch (err) {
      console.error('Error clearing pending installations:', err);
      toast('Failed to clear pending installations', { type: 'error' });
    }
  };

  // Function to resume a specific installation
  const resumeInstallation = (installation: PendingInstallation) => {
    if (installation.type === 'update') {
      // For updates, we would want to update an existing model
      handleModelAction(installation.name, true);
    } else {
      // For new installs
      handleModelAction(installation.name, false);
    }
  };

  // Function to clear a specific pending installation
  const cancelInstallation = (name: string) => {
    try {
      const updated = pendingInstallations.filter((p) => p.name !== name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setPendingInstallations(updated);
      toast(`Installation of ${name} cancelled`);
    } catch (err) {
      console.error('Error cancelling installation:', err);
      toast('Failed to cancel installation', { type: 'error' });
    }
  };

  // Function to format date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);

    return date.toLocaleString();
  };

  // Utility function to format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
      return '0 B';
    }

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Function to install a model
  const handleModelAction = async (modelName: string, isUpdate = false) => {
    if (!isConnected) {
      toast('Cannot install model: Ollama server is not connected', { type: 'error' });
      return;
    }

    try {
      setInstallStatus('installing');
      setSelectedModel(modelName);
      setProgress({ percent: 0, current: 0, total: 0, status: 'starting' });

      // Track this installation in localStorage for persistence
      savePendingInstallation(modelName, isUpdate ? 'update' : 'install');

      const response = await fetch(`${baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      let progressData = '';

      // Parse progress from stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Convert the Uint8Array to a string
        const chunk = new TextDecoder('utf-8').decode(value);
        progressData += chunk;

        // Split by newlines and process each message
        const lines = progressData.split('\n');
        progressData = lines.pop() || ''; // Keep the last incomplete line

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);

              if (data.status === 'downloading' && data.total && data.completed) {
                // Calculate download progress
                const percent = Math.round((data.completed / data.total) * 100);

                setProgress({
                  percent,
                  current: formatBytes(data.completed),
                  total: formatBytes(data.total),
                  status: 'downloading',
                });
              } else if (data.status) {
                // Update status message
                setProgress((prev) => ({
                  ...prev,
                  status: data.status,
                }));
              }
            } catch (e) {
              console.error('Error parsing JSON message:', e, line);
            }
          }
        }
      }

      // Remove from pending installations
      removePendingInstallation(modelName);

      setInstallStatus('success');
      toast(`Model ${modelName} installed successfully`);

      /*
       * Give the Ollama server time to register the new model before refreshing
       * Ollama sometimes needs a brief moment to update its internal state
       */
      setTimeout(() => {
        console.log('Refreshing models list after successful installation');

        /*
         * Refresh the models list multiple times with increasing delays
         * This ensures we catch the new model even if Ollama is slow to register it
         */
        if (modelsListRef.current) {
          // Use refreshNow=true for immediate refresh
          modelsListRef.current.refreshModels(true);

          // Additional refresh attempts with increasing delays
          setTimeout(() => modelsListRef.current?.refreshModels(true), 1000);
          setTimeout(() => modelsListRef.current?.refreshModels(true), 3000);
        }

        if (onModelInstalled) {
          onModelInstalled();
        }
      }, 500);

      // Reset after a delay
      setTimeout(() => {
        setSelectedModel(null);
        setInstallStatus(null);
        setProgress({ percent: 0, current: 0, total: 0, status: '' });
      }, 3000);
    } catch (error) {
      console.error('Error installing model:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setInstallStatus('error');
      setInstallError(errorMessage);
      toast(`Error installing model: ${errorMessage}`, { type: 'error' });
    }
  };

  // Helper function to save pending installation to localStorage
  const savePendingInstallation = (name: string, type: 'install' | 'update') => {
    try {
      // Get existing pending installations
      const stored = localStorage.getItem(STORAGE_KEY);
      const pendingInstallations: PendingInstallation[] = stored ? JSON.parse(stored) : [];

      // Remove any existing entries for this model
      const filtered = pendingInstallations.filter((p) => p.name !== name);

      // Add new pending installation
      const updated = [...filtered, { name, type, startedAt: Date.now() }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Update state for UI
      setPendingInstallations(updated);
    } catch (err) {
      console.error('Error saving pending installation to storage:', err);
    }
  };

  // Helper function to remove pending installation from localStorage
  const removePendingInstallation = (name: string) => {
    try {
      // Get existing pending installations
      const stored = localStorage.getItem(STORAGE_KEY);
      const pendingInstallations: PendingInstallation[] = stored ? JSON.parse(stored) : [];

      // Remove the installation
      const updated = pendingInstallations.filter((p) => p.name !== name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Update state for UI
      setPendingInstallations(updated);
    } catch (err) {
      console.error('Error removing pending installation from storage:', err);
    }
  };

  // Wrapper function to handle action completions
  const handleActionComplete = () => {
    if (modelsListRef.current) {
      modelsListRef.current.refreshModels();
    }

    if (onModelInstalled) {
      onModelInstalled();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Pending Installations Warning Banner */}
      {pendingInstallations.length > 0 && (
        <div className="bg-bolt-elements-button-warning-background/20 border border-bolt-elements-button-warning-text/40 rounded-lg p-3 mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="i-ph:warning-circle w-4 h-4 text-bolt-elements-button-warning-text" />
              <h3 className="font-medium text-bolt-elements-button-warning-text text-sm">
                {pendingInstallations.length} Pending{' '}
                {pendingInstallations.length === 1 ? 'Installation' : 'Installations'}
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllPendingInstallations}
              className="text-bolt-elements-button-warning-text border-bolt-elements-button-warning-text/30 hover:bg-bolt-elements-button-warning-background/20 text-xs py-1 h-auto"
            >
              Clear All
            </Button>
          </div>

          <p className="text-xs text-bolt-elements-textSecondary mb-2">
            The following model installations were interrupted and can be resumed:
          </p>

          <div className="space-y-1.5">
            {pendingInstallations.map((installation) => (
              <div
                key={installation.name}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-bolt-elements-background-depth-2 p-2 rounded-md border border-bolt-elements-borderColor"
              >
                <div>
                  <p className="font-medium text-sm">{installation.name}</p>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    {installation.type === 'update' ? 'Update' : 'Installation'} started{' '}
                    {formatDate(installation.startedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resumeInstallation(installation)}
                    className="bg-bolt-elements-background-depth-1 text-xs py-1 h-auto"
                  >
                    <span className="i-ph:play mr-1 text-bolt-elements-button-success-text" />
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelInstallation(installation.name)}
                    className="bg-bolt-elements-background-depth-1 text-xs py-1 h-auto"
                  >
                    <span className="i-ph:x mr-1 text-bolt-elements-button-danger-text" />
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installed Models List Component */}
      <div className="mt-1 mb-4">
        <OllamaModelsList
          ref={modelsListRef}
          baseUrl={baseUrl}
          onActionComplete={handleActionComplete}
          isConnected={isConnected}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-bolt-elements-borderColor my-1"></div>

      {/* Model Library Component */}
      <OllamaModelLibrary baseUrl={baseUrl} onModelInstalled={handleModelAction} isConnected={isConnected} />
    </div>
  );
}

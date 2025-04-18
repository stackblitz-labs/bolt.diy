import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '~/components/ui/use-toast';
import { Button } from '~/components/ui/Button';

// Simple Skeleton component since it's not available
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-bolt-elements-background-depth-3 rounded ${className || ''}`} />
);

interface LmStudioModelsProps {
  baseUrl?: string;
  isConnected: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
  size?: string;
  modified?: string;
  quantization?: string;
  parameters?: string;
  status?: 'idle' | 'deleting' | 'error';
}

// Define response type interface
interface LmStudioResponse {
  data?: any[];
  [key: string]: any;
}

const LmStudioModels: React.FC<LmStudioModelsProps> = ({ baseUrl = 'http://127.0.0.1:1234', isConnected }) => {
  const { toast } = useToast();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchAbortController = useRef<AbortController | null>(null);

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) {
      return 'Unknown';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Format date
  const formatDate = (timestamp?: string): string => {
    if (!timestamp) {
      return 'Unknown';
    }

    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  // Fetch models from LM Studio with improved error handling for Cloudflare environment
  const fetchModels = async () => {
    if (!isConnected) {
      setError('LM Studio is not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Cancel any ongoing requests
    if (fetchAbortController.current) {
      fetchAbortController.current.abort();
    }

    // Create a new abort controller for this request
    fetchAbortController.current = new AbortController();

    try {
      // Use our proxy to avoid CORS issues - this will be handled by the Cloudflare worker
      const proxyUrl = new URL('/api/proxy/lmstudio', window.location.origin);
      proxyUrl.searchParams.set('path', '/v1/models');
      proxyUrl.searchParams.set('baseUrl', baseUrl);

      console.log(`Fetching LM Studio models from: ${proxyUrl.toString()}`);

      const response = await fetch(proxyUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: fetchAbortController.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      let responseData: LmStudioResponse | any[] = {};
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        throw new Error(`Invalid content type: ${contentType || 'unknown'}`);
      }

      if (!responseData) {
        throw new Error('Invalid response format from LM Studio');
      }

      console.log('LM Studio response:', responseData);

      // Handle different response formats
      let modelData: any[] = [];

      if ('data' in responseData && Array.isArray(responseData.data)) {
        // Standard format
        modelData = responseData.data;
      } else if (Array.isArray(responseData)) {
        // Alternative format
        modelData = responseData;
      } else {
        throw new Error('Unexpected response format from LM Studio');
      }

      console.log('LM Studio models:', modelData);

      // Transform the data into our model format
      const modelList: ModelInfo[] = modelData.map((model) => {
        try {
          return {
            id: model.id || String(Math.random()).substring(2, 10),
            name: model.name || model.id || 'Unnamed Model',
            size: formatSize(typeof model.size === 'number' ? model.size : undefined),
            modified: formatDate(model.modified),
            quantization: model.quantization || undefined,
            parameters: model.parameters ? `${model.parameters}` : undefined,
            status: 'idle',
          };
        } catch (err) {
          console.error('Error processing model:', err, model);
          return {
            id: String(Math.random()).substring(2, 10),
            name: 'Error processing model',
            size: 'Unknown',
            status: 'error',
          };
        }
      });

      setModels(modelList);

      if (modelList.length > 0) {
        toast(`Found ${modelList.length} models in LM Studio`);
      } else {
        toast('No models found in LM Studio');
      }
    } catch (error) {
      console.error('Error fetching LM Studio models:', error);

      // Handle different error types appropriately
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('Fetch request was aborted');
          return;
        }

        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          setError('Network error connecting to LM Studio. Check if the server is running.');
        } else {
          setError(error.message);
        }
      } else {
        setError('Unknown error occurred');
      }

      toast(`Failed to fetch LM Studio models: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      fetchAbortController.current = null;
    }
  };

  // Clean up and fetch models on mount/change
  useEffect(() => {
    if (isConnected) {
      fetchModels();
    }

    return () => {
      // Clean up on unmount
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }

      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
    };
  }, [baseUrl, isConnected]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="i-ph:cube text-bolt-elements-button-primary-text text-xl" />
          <h3 className="font-medium">Installed Models</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchModels}
            className="flex items-center gap-1 bg-bolt-elements-background-depth-1"
            disabled={isLoading || !isConnected}
          >
            {isLoading ? (
              <div className="i-ph:spinner-gap-bold animate-spin mr-1 text-bolt-elements-textPrimary" />
            ) : (
              <span className="i-ph:arrows-clockwise mr-1 text-bolt-elements-textPrimary" />
            )}
            Refresh
          </Button>
          <span className="text-sm text-bolt-elements-textSecondary">{models.length} models available</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
          <p className="text-bolt-elements-textDanger">{error}</p>
          <p className="text-sm text-bolt-elements-textSecondary mt-2">
            Make sure LM Studio is running and properly configured.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2"
            >
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {models.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="bg-bolt-elements-background-depth-2 p-4 rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="i-ph:cube text-bolt-elements-button-primary-text text-xl" />
                      <div className="flex flex-col">
                        <p className="font-medium">{model.name}</p>
                        <div className="flex items-center gap-1 text-xs text-bolt-elements-textSecondary">
                          {model.size && <span>{model.size}</span>}
                          {model.parameters && (
                            <>
                              <span>•</span>
                              <span>{model.parameters}</span>
                            </>
                          )}
                          {model.quantization && (
                            <>
                              <span>•</span>
                              <span>{model.quantization}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {model.modified && (
                    <div className="mt-2 text-xs text-bolt-elements-textSecondary">Modified: {model.modified}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-bolt-elements-background-depth-2 p-6 rounded-lg border border-bolt-elements-borderColor flex flex-col items-center justify-center gap-2">
              <div className="i-ph:cube-transparent w-12 h-12 text-bolt-elements-textPrimary" />
              <p className="text-lg font-medium">No installed models</p>
              <p className="text-sm text-bolt-elements-textSecondary">
                {isConnected
                  ? 'No models found in LM Studio. Add models through the LM Studio application.'
                  : 'Connect to LM Studio to view installed models.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LmStudioModels;

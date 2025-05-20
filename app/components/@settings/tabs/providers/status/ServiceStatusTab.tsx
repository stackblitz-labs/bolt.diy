import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { TbActivityHeartbeat } from 'react-icons/tb';
import { BsCheckCircleFill, BsXCircleFill, BsExclamationCircleFill } from 'react-icons/bs';
import { SiAmazon, SiGoogle, SiHuggingface, SiPerplexity, SiOpenai } from 'react-icons/si';
import { BsRobot, BsCloud } from 'react-icons/bs';
import { TbBrain } from 'react-icons/tb';
import { BiChip, BiCodeBlock } from 'react-icons/bi';
import { FaCloud, FaBrain, FaRegLemon } from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { useSettings } from '~/lib/hooks/useSettings';
import { useToast } from '~/components/ui/use-toast';

// Types
type ProviderName =
  | 'AmazonBedrock'
  | 'Anthropic'
  | 'Cohere'
  | 'Deepseek'
  | 'Google'
  | 'Groq'
  | 'HuggingFace'
  | 'Mistral'
  | 'OpenAI'
  | 'OpenRouter'
  | 'Perplexity'
  | 'Pollinations'
  | 'Together'
  | 'XAI';

type ServiceStatus = {
  provider: ProviderName;
  status: 'operational' | 'degraded' | 'down';
  lastChecked: string;
  statusUrl?: string;
  icon?: IconType;
  message?: string;
  responseTime?: number;
  incidents?: string[];
};

type ProviderConfig = {
  statusUrl: string;
  apiUrl: string;
  headers: Record<string, string>;
  testModel: string;
};

// Types for API responses
type ApiResponse = {
  error?: {
    message: string;
  };
  message?: string;
  model?: string;
  models?: Array<{
    id?: string;
    name?: string;
  }>;
  data?: Array<{
    id?: string;
    name?: string;
  }>;
};

// Constants
const PROVIDER_STATUS_URLS: Record<ProviderName, ProviderConfig> = {
  OpenAI: {
    statusUrl: 'https://status.openai.com/',
    apiUrl: 'https://api.openai.com/v1/models',
    headers: {
      Authorization: 'Bearer $OPENAI_API_KEY',
    },
    testModel: 'gpt-3.5-turbo',
  },
  Anthropic: {
    statusUrl: 'https://status.anthropic.com/',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    headers: {
      'x-api-key': '$ANTHROPIC_API_KEY',
      'anthropic-version': '2024-02-29',
    },
    testModel: 'claude-3-sonnet-20240229',
  },
  Cohere: {
    statusUrl: 'https://status.cohere.com/',
    apiUrl: 'https://api.cohere.ai/v1/models',
    headers: {
      Authorization: 'Bearer $COHERE_API_KEY',
    },
    testModel: 'command',
  },
  Google: {
    statusUrl: 'https://status.cloud.google.com/',
    apiUrl: 'https://generativelanguage.googleapis.com/v1/models',
    headers: {
      'x-goog-api-key': '$GOOGLE_API_KEY',
    },
    testModel: 'gemini-pro',
  },
  HuggingFace: {
    statusUrl: 'https://status.huggingface.co/',
    apiUrl: 'https://api-inference.huggingface.co/models',
    headers: {
      Authorization: 'Bearer $HUGGINGFACE_API_KEY',
    },
    testModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  },
  Mistral: {
    statusUrl: 'https://status.mistral.ai/',
    apiUrl: 'https://api.mistral.ai/v1/models',
    headers: {
      Authorization: 'Bearer $MISTRAL_API_KEY',
    },
    testModel: 'mistral-tiny',
  },
  Perplexity: {
    statusUrl: 'https://status.perplexity.com/',
    apiUrl: 'https://api.perplexity.ai/v1/models',
    headers: {
      Authorization: 'Bearer $PERPLEXITY_API_KEY',
    },
    testModel: 'pplx-7b-chat',
  },
  Together: {
    statusUrl: 'https://status.together.ai/',
    apiUrl: 'https://api.together.xyz/v1/models',
    headers: {
      Authorization: 'Bearer $TOGETHER_API_KEY',
    },
    testModel: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  },
  AmazonBedrock: {
    statusUrl: 'https://health.aws.amazon.com/health/status',
    apiUrl: 'https://bedrock.us-east-1.amazonaws.com/models',
    headers: {
      Authorization: 'Bearer $AWS_BEDROCK_CONFIG',
    },
    testModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
  Groq: {
    statusUrl: 'https://groqstatus.com/',
    apiUrl: 'https://api.groq.com/v1/models',
    headers: {
      Authorization: 'Bearer $GROQ_API_KEY',
    },
    testModel: 'mixtral-8x7b-32768',
  },
  OpenRouter: {
    statusUrl: 'https://status.openrouter.ai/',
    apiUrl: 'https://openrouter.ai/api/v1/models',
    headers: {
      Authorization: 'Bearer $OPEN_ROUTER_API_KEY',
    },
    testModel: 'anthropic/claude-3-sonnet',
  },
  XAI: {
    statusUrl: 'https://status.x.ai/',
    apiUrl: 'https://api.x.ai/v1/models',
    headers: {
      Authorization: 'Bearer $XAI_API_KEY',
    },
    testModel: 'grok-1',
  },
  Deepseek: {
    statusUrl: 'https://status.deepseek.com/',
    apiUrl: 'https://api.deepseek.com/v1/models',
    headers: {
      Authorization: 'Bearer $DEEPSEEK_API_KEY',
    },
    testModel: 'deepseek-chat',
  },
  Pollinations: {
    statusUrl: 'https://pollinations.ai/',
    apiUrl: 'https://text.pollinations.ai/openai/v1/models',
    headers: {},
    testModel: 'haiku',
  },
};

const PROVIDER_ICONS: Record<ProviderName, IconType> = {
  AmazonBedrock: SiAmazon,
  Anthropic: FaBrain,
  Cohere: BiChip,
  Google: SiGoogle,
  Groq: BsCloud,
  HuggingFace: SiHuggingface,
  Mistral: TbBrain,
  OpenAI: SiOpenai,
  OpenRouter: FaCloud,
  Perplexity: SiPerplexity,
  Together: BsCloud,
  XAI: BsRobot,
  Deepseek: BiCodeBlock,
  Pollinations: FaRegLemon,
};

const ServiceStatusTab = () => {
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [testApiKey, setTestApiKey] = useState<string>('');
  const [testProvider, setTestProvider] = useState<ProviderName | ''>('');
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const settings = useSettings();
  const { success, error } = useToast();

  // Function to get the API key for a provider from environment variables
  const getApiKey = useCallback(
    (provider: ProviderName): string | null => {
      if (!settings.providers) {
        return null;
      }

      // Map provider names to environment variable names
      const envKeyMap: Record<ProviderName, string> = {
        OpenAI: 'OPENAI_API_KEY',
        Anthropic: 'ANTHROPIC_API_KEY',
        Cohere: 'COHERE_API_KEY',
        Google: 'GOOGLE_GENERATIVE_AI_API_KEY',
        HuggingFace: 'HuggingFace_API_KEY',
        Mistral: 'MISTRAL_API_KEY',
        Perplexity: 'PERPLEXITY_API_KEY',
        Together: 'TOGETHER_API_KEY',
        AmazonBedrock: 'AWS_BEDROCK_CONFIG',
        Groq: 'GROQ_API_KEY',
        OpenRouter: 'OPEN_ROUTER_API_KEY',
        XAI: 'XAI_API_KEY',
        Deepseek: 'DEEPSEEK_API_KEY',
        Pollinations: 'POLLINATIONS_API_BASE_URL',
      };

      const envKey = envKeyMap[provider];

      if (!envKey) {
        return null;
      }

      // Get the API key from environment variables
      const apiKey = (import.meta.env[envKey] as string) || null;

      // Special handling for providers with base URLs
      if (provider === 'Together' && apiKey) {
        const baseUrl = import.meta.env.TOGETHER_API_BASE_URL;

        if (!baseUrl) {
          return null;
        }
      }

      return apiKey;
    },
    [settings.providers],
  );

  // Update provider configurations based on available API keys
  const getProviderConfig = useCallback((provider: ProviderName): ProviderConfig | null => {
    const config = PROVIDER_STATUS_URLS[provider];

    if (!config) {
      return null;
    }

    // Handle special cases for providers with base URLs
    let updatedConfig = { ...config };
    const togetherBaseUrl = import.meta.env.TOGETHER_API_BASE_URL;

    if (provider === 'Together' && togetherBaseUrl) {
      updatedConfig = {
        ...config,
        apiUrl: `${togetherBaseUrl}/models`,
      };
    }

    return updatedConfig;
  }, []);

  // Function to check if an API endpoint is accessible with model verification
  const checkApiEndpoint = useCallback(
    async (
      url: string,
      headers?: Record<string, string>,
      testModel?: string,
    ): Promise<{ ok: boolean; status: number | string; message?: string; responseTime: number }> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const startTime = performance.now();

        // Add common headers
        const processedHeaders = {
          'Content-Type': 'application/json',
          ...headers,
        };

        // First check if the API is accessible
        const response = await fetch(url, {
          method: 'GET',
          headers: processedHeaders,
          signal: controller.signal,
        });

        const endTime = performance.now();
        const responseTime = endTime - startTime;

        clearTimeout(timeoutId);

        // Get response data
        const data = (await response.json()) as ApiResponse;

        // Special handling for different provider responses
        if (!response.ok) {
          let errorMessage = `API returned status: ${response.status}`;

          // Handle provider-specific error messages
          if (data.error?.message) {
            errorMessage = data.error.message;
          } else if (data.message) {
            errorMessage = data.message;
          }

          return {
            ok: false,
            status: response.status,
            message: errorMessage,
            responseTime,
          };
        }

        // Different providers have different model list formats
        let models: string[] = [];

        if (Array.isArray(data)) {
          models = data.map((model: { id?: string; name?: string }) => model.id || model.name || '');
        } else if (data.data && Array.isArray(data.data)) {
          models = data.data.map((model) => model.id || model.name || '');
        } else if (data.models && Array.isArray(data.models)) {
          models = data.models.map((model) => model.id || model.name || '');
        } else if (data.model) {
          // Some providers return single model info
          models = [data.model];
        }

        // For some providers, just having a successful response is enough
        if (!testModel || models.length > 0) {
          return {
            ok: true,
            status: response.status,
            responseTime,
            message: 'API key is valid',
          };
        }

        // If a specific model was requested, verify it exists
        if (testModel && !models.includes(testModel)) {
          return {
            ok: true, // Still mark as ok since API works
            status: 'model_not_found',
            message: `API key is valid (test model ${testModel} not found in ${models.length} available models)`,
            responseTime,
          };
        }

        return {
          ok: true,
          status: response.status,
          message: 'API key is valid',
          responseTime,
        };
      } catch (error) {
        console.error(`Error checking API endpoint ${url}:`, error);
        return {
          ok: false,
          status: error instanceof Error ? error.message : 'Unknown error',
          message: error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed',
          responseTime: 0,
        };
      }
    },
    [getApiKey],
  );

  // Function to fetch real status from provider status pages
  const fetchPublicStatus = useCallback(
    async (
      provider: ProviderName,
    ): Promise<{
      status: ServiceStatus['status'];
      message?: string;
      incidents?: string[];
    }> => {
      try {
        // Due to CORS restrictions, we can only check if the endpoints are reachable
        const checkEndpoint = async (url: string) => {
          try {
            const response = await fetch(url, {
              mode: 'no-cors',
              headers: {
                Accept: 'text/html',
              },
            });

            // With no-cors, we can only know if the request succeeded
            return response.type === 'opaque' ? 'reachable' : 'unreachable';
          } catch (error) {
            console.error(`Error checking ${url}:`, error);
            return 'unreachable';
          }
        };

        switch (provider) {
          case 'HuggingFace': {
            const endpointStatus = await checkEndpoint('https://status.huggingface.co/');

            // Check API endpoint as fallback
            const apiEndpoint = 'https://api-inference.huggingface.co/models';
            const apiStatus = await checkEndpoint(apiEndpoint);

            return {
              status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
              message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
              incidents: ['Note: Limited status information due to CORS restrictions'],
            };
          }

          case 'OpenAI': {
            const endpointStatus = await checkEndpoint('https://status.openai.com/');
            const apiEndpoint = 'https://api.openai.com/v1/models';
            const apiStatus = await checkEndpoint(apiEndpoint);

            return {
              status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
              message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
              incidents: ['Note: Limited status information due to CORS restrictions'],
            };
          }

          case 'Google': {
            const endpointStatus = await checkEndpoint('https://status.cloud.google.com/');
            const apiEndpoint = 'https://generativelanguage.googleapis.com/v1/models';
            const apiStatus = await checkEndpoint(apiEndpoint);

            return {
              status: endpointStatus === 'reachable' && apiStatus === 'reachable' ? 'operational' : 'degraded',
              message: `Status page: ${endpointStatus}, API: ${apiStatus}`,
              incidents: ['Note: Limited status information due to CORS restrictions'],
            };
          }

          // Similar pattern for other providers...
          default:
            return {
              status: 'operational',
              message: 'Basic reachability check only',
              incidents: ['Note: Limited status information due to CORS restrictions'],
            };
        }
      } catch (error) {
        console.error(`Error fetching status for ${provider}:`, error);
        return {
          status: 'degraded',
          message: 'Unable to fetch status due to CORS restrictions',
          incidents: ['Error: Unable to check service status'],
        };
      }
    },
    [],
  );

  // Function to fetch status for a provider with retries
  const fetchProviderStatus = useCallback(
    async (provider: ProviderName, config: ProviderConfig): Promise<ServiceStatus> => {
      const MAX_RETRIES = 2;
      const RETRY_DELAY = 2000; // 2 seconds

      const attemptCheck = async (attempt: number): Promise<ServiceStatus> => {
        try {
          // First check the public status page if available
          const hasPublicStatus = [
            'Anthropic',
            'OpenAI',
            'Google',
            'HuggingFace',
            'Mistral',
            'Groq',
            'Perplexity',
            'Together',
          ].includes(provider);

          if (hasPublicStatus) {
            const publicStatus = await fetchPublicStatus(provider);

            return {
              provider,
              status: publicStatus.status,
              lastChecked: new Date().toISOString(),
              statusUrl: config.statusUrl,
              icon: PROVIDER_ICONS[provider],
              message: publicStatus.message,
              incidents: publicStatus.incidents,
            };
          }

          // For other providers, we'll show status but mark API check as separate
          const apiKey = getApiKey(provider);
          const providerConfig = getProviderConfig(provider);

          if (!apiKey || !providerConfig) {
            return {
              provider,
              status: 'operational',
              lastChecked: new Date().toISOString(),
              statusUrl: config.statusUrl,
              icon: PROVIDER_ICONS[provider],
              message: !apiKey
                ? 'Status operational (API key needed for usage)'
                : 'Status operational (configuration needed for usage)',
              incidents: [],
            };
          }

          // If we have API access, let's verify that too
          const { ok, status, message, responseTime } = await checkApiEndpoint(
            providerConfig.apiUrl,
            providerConfig.headers,
            providerConfig.testModel,
          );

          if (!ok && attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            return attemptCheck(attempt + 1);
          }

          return {
            provider,
            status: ok ? 'operational' : 'degraded',
            lastChecked: new Date().toISOString(),
            statusUrl: providerConfig.statusUrl,
            icon: PROVIDER_ICONS[provider],
            message: ok ? 'Service and API operational' : `Service operational (API: ${message || status})`,
            responseTime,
            incidents: [],
          };
        } catch (error) {
          console.error(`Error fetching status for ${provider} (attempt ${attempt}):`, error);

          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            return attemptCheck(attempt + 1);
          }

          return {
            provider,
            status: 'degraded',
            lastChecked: new Date().toISOString(),
            statusUrl: config.statusUrl,
            icon: PROVIDER_ICONS[provider],
            message: 'Service operational (Status check error)',
            responseTime: 0,
            incidents: [],
          };
        }
      };

      return attemptCheck(1);
    },
    [checkApiEndpoint, getApiKey, getProviderConfig, fetchPublicStatus],
  );

  // Memoize the fetchAllStatuses function
  const fetchAllStatuses = useCallback(async () => {
    try {
      setLoading(true);

      const statuses = await Promise.all(
        Object.entries(PROVIDER_STATUS_URLS).map(([provider, config]) =>
          fetchProviderStatus(provider as ProviderName, config),
        ),
      );

      setServiceStatuses(statuses.sort((a, b) => a.provider.localeCompare(b.provider)));
      setLastRefresh(new Date());
      success('Service statuses updated successfully');
    } catch (err) {
      console.error('Error fetching all statuses:', err);
      error('Failed to update service statuses');
    } finally {
      setLoading(false);
    }
  }, [fetchProviderStatus, success, error]);

  useEffect(() => {
    fetchAllStatuses();

    // Refresh status every 2 minutes
    const interval = setInterval(fetchAllStatuses, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchAllStatuses]);

  // Function to test an API key
  const testApiKeyForProvider = useCallback(
    async (provider: ProviderName, apiKey: string) => {
      try {
        setTestingStatus('testing');

        const config = PROVIDER_STATUS_URLS[provider];

        if (!config) {
          throw new Error('Provider configuration not found');
        }

        const headers = { ...config.headers };

        // Replace the placeholder API key with the test key
        Object.keys(headers).forEach((key) => {
          if (headers[key].startsWith('$')) {
            headers[key] = headers[key].replace(/\$.*/, apiKey);
          }
        });

        // Special handling for certain providers
        switch (provider) {
          case 'Anthropic':
            headers['anthropic-version'] = '2024-02-29';
            break;
          case 'OpenAI':
            if (!headers.Authorization?.startsWith('Bearer ')) {
              headers.Authorization = `Bearer ${apiKey}`;
            }

            break;
          case 'Google': {
            // Google uses the API key directly in the URL
            const googleUrl = `${config.apiUrl}?key=${apiKey}`;
            const result = await checkApiEndpoint(googleUrl, {}, config.testModel);

            if (result.ok) {
              setTestingStatus('success');
              success('API key is valid!');
            } else {
              setTestingStatus('error');
              error(`API key test failed: ${result.message}`);
            }

            return;
          }
        }

        const { ok, message } = await checkApiEndpoint(config.apiUrl, headers, config.testModel);

        if (ok) {
          setTestingStatus('success');
          success('API key is valid!');
        } else {
          setTestingStatus('error');
          error(`API key test failed: ${message}`);
        }
      } catch (err: unknown) {
        setTestingStatus('error');
        error('Failed to test API key: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        // Reset testing status after a delay
        setTimeout(() => setTestingStatus('idle'), 3000);
      }
    },
    [checkApiEndpoint, success, error],
  );

  const getStatusColor = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'operational':
        return <BsCheckCircleFill className="w-4 h-4" />;
      case 'degraded':
        return <BsExclamationCircleFill className="w-4 h-4" />;
      case 'down':
        return <BsXCircleFill className="w-4 h-4" />;
      default:
        return <BsXCircleFill className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between gap-2 mt-8 mb-4">
          <div className="flex items-center gap-2">
            <div
              className={classNames(
                'w-8 h-8 flex items-center justify-center rounded-lg',
                'bg-bolt-elements-background-depth-3',
                'text-purple-500',
              )}
            >
              <TbActivityHeartbeat className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-md font-medium text-bolt-elements-textPrimary">Service Status</h4>
              <p className="text-sm text-bolt-elements-textSecondary">
                Monitor and test the operational status of cloud LLM providers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-bolt-elements-textSecondary">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <button
              onClick={() => fetchAllStatuses()}
              className={classNames(
                'px-3 py-1.5 rounded-lg text-sm',
                'bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4',
                'text-bolt-elements-textPrimary',
                'transition-all duration-200',
                'flex items-center gap-2',
                loading ? 'opacity-50 cursor-not-allowed' : '',
              )}
              disabled={loading}
            >
              <div className={`i-ph:arrows-clockwise w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* API Key Test Section */}
        <div className="p-4 bg-bolt-elements-background-depth-2 rounded-lg">
          <h5 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Test API Key</h5>
          <div className="flex gap-2">
            <select
              value={testProvider}
              onChange={(e) => setTestProvider(e.target.value as ProviderName)}
              className={classNames(
                'flex-1 px-3 py-1.5 rounded-lg text-sm max-w-[200px]',
                'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                'text-bolt-elements-textPrimary',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              )}
            >
              <option value="">Select Provider</option>
              {Object.keys(PROVIDER_STATUS_URLS).map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            <input
              type="password"
              value={testApiKey}
              onChange={(e) => setTestApiKey(e.target.value)}
              placeholder="Enter API key to test"
              className={classNames(
                'flex-1 px-3 py-1.5 rounded-lg text-sm',
                'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
                'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              )}
            />
            <button
              onClick={() =>
                testProvider && testApiKey && testApiKeyForProvider(testProvider as ProviderName, testApiKey)
              }
              disabled={!testProvider || !testApiKey || testingStatus === 'testing'}
              className={classNames(
                'px-4 py-1.5 rounded-lg text-sm',
                'bg-purple-500 hover:bg-purple-600',
                'text-white',
                'transition-all duration-200',
                'flex items-center gap-2',
                !testProvider || !testApiKey || testingStatus === 'testing' ? 'opacity-50 cursor-not-allowed' : '',
              )}
            >
              {testingStatus === 'testing' ? (
                <>
                  <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <>
                  <div className="i-ph:key w-4 h-4" />
                  <span>Test Key</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Grid */}
        {loading && serviceStatuses.length === 0 ? (
          <div className="text-center py-8 text-bolt-elements-textSecondary">Loading service statuses...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceStatuses.map((service, index) => (
              <motion.div
                key={service.provider}
                className={classNames(
                  'bg-bolt-elements-background-depth-2',
                  'hover:bg-bolt-elements-background-depth-3',
                  'transition-all duration-200',
                  'relative overflow-hidden rounded-lg',
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div
                  className={classNames('block p-4', service.statusUrl ? 'cursor-pointer' : '')}
                  onClick={() => service.statusUrl && window.open(service.statusUrl, '_blank')}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {service.icon && (
                        <div
                          className={classNames(
                            'w-8 h-8 flex items-center justify-center rounded-lg',
                            'bg-bolt-elements-background-depth-3',
                            getStatusColor(service.status),
                          )}
                        >
                          {React.createElement(service.icon, {
                            className: 'w-5 h-5',
                          })}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{service.provider}</h4>
                        <div className="space-y-1">
                          <p className="text-xs text-bolt-elements-textSecondary">
                            Last checked: {new Date(service.lastChecked).toLocaleTimeString()}
                          </p>
                          {service.responseTime && (
                            <p className="text-xs text-bolt-elements-textTertiary">
                              Response time: {Math.round(service.responseTime)}ms
                            </p>
                          )}
                          {service.message && (
                            <p className="text-xs text-bolt-elements-textTertiary">{service.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={classNames('flex items-center gap-2', getStatusColor(service.status))}>
                      <span className="text-sm capitalize">{service.status}</span>
                      {getStatusIcon(service.status)}
                    </div>
                  </div>
                  {service.incidents && service.incidents.length > 0 && (
                    <div className="mt-2 border-t border-bolt-elements-borderColor pt-2">
                      <p className="text-xs font-medium text-bolt-elements-textSecondary mb-1">Recent Incidents:</p>
                      <ul className="text-xs text-bolt-elements-textTertiary space-y-1">
                        {service.incidents.map((incident, i) => (
                          <li key={i}>{incident}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

// Add tab metadata
ServiceStatusTab.tabMetadata = {
  icon: 'i-ph:activity-bold',
  description: 'Monitor and test LLM provider service status',
  category: 'services',
};

export default ServiceStatusTab;

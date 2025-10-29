/**
 * Personal Development Tools Configuration
 *
 * This configuration optimizes the application for personal development workflows,
 * focusing on performance, stability, and developer productivity features.
 */

export interface DevToolsConfig {
  // Performance settings
  performance: {
    // Enable virtual scrolling for large lists
    enableVirtualScrolling: boolean;
    // Maximum items to render without virtualization
    maxItemsBeforeVirtualization: number;
    // Chunk size for batch processing
    batchProcessingChunkSize: number;
    // Debounce delay for file operations (ms)
    fileOperationDebounce: number;
    // Enable performance monitoring
    enablePerformanceMonitoring: boolean;
  };

  // Error handling
  errorHandling: {
    // Enable error boundaries
    enableErrorBoundaries: boolean;
    // Show detailed error messages
    showDetailedErrors: boolean;
    // Maximum retry attempts for failed operations
    maxRetryAttempts: number;
    // Base retry delay (ms)
    baseRetryDelay: number;
    // Enable automatic error recovery
    enableAutoRecovery: boolean;
  };

  // Caching
  caching: {
    // Enable LRU cache for expensive computations
    enableLRUCache: boolean;
    // Maximum cache size
    maxCacheSize: number;
    // Cache TTL in milliseconds
    cacheTTL: number;
  };

  // Development features
  features: {
    // Enable code snippets library
    enableSnippetsLibrary: boolean;
    // Enable project templates
    enableProjectTemplates: boolean;
    // Enable git integration
    enableGitIntegration: boolean;
    // Enable deployment features
    enableDeployment: boolean;
    // Enable database integration
    enableDatabaseIntegration: boolean;
    // Enable AI-powered code suggestions
    enableAISuggestions: boolean;
    // Preferred AI providers (in order of preference)
    preferredAIProviders: string[];
  };

  // Editor settings
  editor: {
    // Default theme
    theme: 'light-plus' | 'dark-plus';
    // Font size
    fontSize: number;
    // Tab size
    tabSize: number;
    // Enable auto-save
    enableAutoSave: boolean;
    // Auto-save delay (ms)
    autoSaveDelay: number;
    // Enable format on save
    formatOnSave: boolean;
    // Enable minimap
    enableMinimap: boolean;
  };

  // Terminal settings
  terminal: {
    // Default shell
    defaultShell: string;
    // Font size
    fontSize: number;
    // Enable terminal persistence
    enablePersistence: boolean;
  };

  // File management
  fileManagement: {
    // Hidden file patterns (in addition to defaults)
    additionalHiddenPatterns: RegExp[];
    // Maximum file size to display inline (bytes)
    maxInlineFileSize: number;
    // Enable file watching
    enableFileWatching: boolean;
  };
}

/**
 * Default configuration optimized for personal development tools
 */
export const defaultDevToolsConfig: DevToolsConfig = {
  performance: {
    enableVirtualScrolling: true,
    maxItemsBeforeVirtualization: 100,
    batchProcessingChunkSize: 50,
    fileOperationDebounce: 300,
    enablePerformanceMonitoring: true,
  },

  errorHandling: {
    enableErrorBoundaries: true,
    showDetailedErrors: true,
    maxRetryAttempts: 3,
    baseRetryDelay: 1000,
    enableAutoRecovery: true,
  },

  caching: {
    enableLRUCache: true,
    maxCacheSize: 100,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
  },

  features: {
    enableSnippetsLibrary: true,
    enableProjectTemplates: true,
    enableGitIntegration: true,
    enableDeployment: true,
    enableDatabaseIntegration: true,
    enableAISuggestions: true,
    preferredAIProviders: [
      'Anthropic',
      'OpenAI',
      'Ollama', // Local AI for privacy
      'LMStudio', // Local AI for offline work
    ],
  },

  editor: {
    theme: 'dark-plus',
    fontSize: 14,
    tabSize: 2,
    enableAutoSave: true,
    autoSaveDelay: 1000,
    formatOnSave: true,
    enableMinimap: true,
  },

  terminal: {
    defaultShell: 'bash',
    fontSize: 14,
    enablePersistence: true,
  },

  fileManagement: {
    additionalHiddenPatterns: [
      /\.DS_Store/,
      /\.vscode/,
      /\.idea/,
      /\.git$/,
      /\.env\.local/,
      /coverage\//,
      /\.nyc_output\//,
    ],
    maxInlineFileSize: 1024 * 1024, // 1MB
    enableFileWatching: true,
  },
};

/**
 * Get the current dev tools configuration
 * Merges defaults with user preferences from localStorage
 */
export function getDevToolsConfig(): DevToolsConfig {
  if (typeof window === 'undefined') {
    return defaultDevToolsConfig;
  }

  try {
    const stored = localStorage.getItem('devtools_config');
    if (stored) {
      const userConfig = JSON.parse(stored);
      return deepMerge(defaultDevToolsConfig, userConfig);
    }
  } catch (error) {
    console.error('Failed to load dev tools config:', error);
  }

  return defaultDevToolsConfig;
}

/**
 * Save dev tools configuration to localStorage
 */
export function saveDevToolsConfig(config: Partial<DevToolsConfig>): boolean {
  try {
    const current = getDevToolsConfig();
    const updated = deepMerge(current, config);
    localStorage.setItem('devtools_config', JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Failed to save dev tools config:', error);
    return false;
  }
}

/**
 * Reset dev tools configuration to defaults
 */
export function resetDevToolsConfig(): void {
  try {
    localStorage.removeItem('devtools_config');
  } catch (error) {
    console.error('Failed to reset dev tools config:', error);
  }
}

/**
 * Deep merge utility for configuration objects
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (isObject(sourceValue) && isObject(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue as any);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

function isObject(value: any): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Development tools presets for different use cases
 */
export const devToolsPresets = {
  // Maximum performance (disable heavy features)
  performance: {
    performance: {
      enableVirtualScrolling: true,
      maxItemsBeforeVirtualization: 50,
      batchProcessingChunkSize: 25,
      fileOperationDebounce: 500,
      enablePerformanceMonitoring: false,
    },
    features: {
      enableAISuggestions: false,
      enableDatabaseIntegration: false,
    },
  } as Partial<DevToolsConfig>,

  // Privacy-focused (local AI only)
  privacy: {
    features: {
      enableAISuggestions: true,
      preferredAIProviders: ['Ollama', 'LMStudio'],
      enableDeployment: false,
    },
  } as Partial<DevToolsConfig>,

  // Full-featured (all features enabled)
  fullFeatured: defaultDevToolsConfig,

  // Minimal (essential features only)
  minimal: {
    features: {
      enableSnippetsLibrary: false,
      enableProjectTemplates: false,
      enableDeployment: false,
      enableDatabaseIntegration: false,
      enableAISuggestions: false,
    },
    caching: {
      enableLRUCache: false,
    },
  } as Partial<DevToolsConfig>,
};

/**
 * Apply a preset configuration
 */
export function applyDevToolsPreset(
  preset: keyof typeof devToolsPresets
): boolean {
  return saveDevToolsConfig(devToolsPresets[preset]);
}

import { createToolSet, type ToolSet } from './toolset';
import { createScopedLogger } from '~/utils/logger';
import type { MCPConfig, MCPServerConfig } from './config';

const logger = createScopedLogger('MCPManager');

/**
 * MCP Manager Class
 * Central management of MCP-related functionality (configuration, toolset)
 */
export class MCPManager {
  private static _instance: MCPManager;
  private _toolset: ToolSet | null = null;
  private _config: MCPConfig = { mcpServers: {} };
  private _initialized: boolean = false;

  private constructor(private readonly _env: Record<string, string | undefined> = {}) {
    this._loadConfigFromEnvironment();
  }

  /**
   * Returns MCPManager instance with initialized tools
   * Works in both Cloudflare and local development environments
   * @param contextOrEnv Cloudflare context object or environment variables object
   */
  static async getInstance(contextOrEnv?: any): Promise<MCPManager> {
    // Handle different types of inputs and extract environment variables
    let envVars: Record<string, string | undefined> = {};

    if (contextOrEnv) {
      if (contextOrEnv.cloudflare?.env) {
        // If Cloudflare context is provided, extract env from it
        envVars = contextOrEnv.cloudflare.env as unknown as Record<string, string | undefined>;
      } else if (typeof contextOrEnv === 'object') {
        // If direct env object is provided
        envVars = contextOrEnv;
      }
    }

    // Fallback to process.env in Node.js environments
    if (Object.keys(envVars).length === 0 && typeof process !== 'undefined') {
      envVars = process.env;
    }

    if (!MCPManager._instance) {
      MCPManager._instance = new MCPManager(envVars);
    }

    if (!MCPManager._instance._initialized) {
      await MCPManager._instance.initializeTools();
    }

    return MCPManager._instance;
  }

  /**
   * Load MCP server configuration from environment variables
   * Finds environment variables with MCP_SSE_ prefix and converts them to server settings
   * Example: MCP_SSE_TEST=http://localhost:3001/sse -> Sets baseUrl for 'test' server
   */
  private _loadConfigFromEnvironment(): void {
    const mcpServers: Record<string, MCPServerConfig> = {};
    const MCP_PREFIX = 'MCP_SSE_';

    // Iterate through all environment variables
    for (const [key, value] of Object.entries(this._env)) {
      // Look for environment variables with MCP_SSE_ prefix
      if (key.startsWith(MCP_PREFIX)) {
        // Extract server name (convert to lowercase for consistency)
        const serverName = key.slice(MCP_PREFIX.length).toLowerCase();

        if (serverName && value) {
          mcpServers[serverName] = {
            baseUrl: value,
          };
        }
      }
    }

    this._config = { mcpServers };
  }

  /**
   * Returns current loaded MCP configuration
   */
  getConfig(): MCPConfig {
    return this._config;
  }

  /**
   * Returns configuration for a specific server
   * @param serverName Server name
   */
  getServerConfig(serverName: string): MCPServerConfig | undefined {
    return this._config.mcpServers[serverName];
  }

  /**
   * Returns list of all server names
   */
  getAllServerNames(): string[] {
    return Object.keys(this._config.mcpServers);
  }

  /**
   * Initialize MCP toolset
   * Converts MCP servers to AI SDK tools
   */
  async initializeTools(): Promise<Record<string, any>> {
    if (this._initialized) {
      logger.info('MCP toolset already initialized');
      return this.tools;
    }

    try {
      // Create ToolSetConfig based on MCP server settings
      const toolSetConfig = {
        mcpServers: Object.entries(this._config.mcpServers).reduce(
          (acc, [name, serverConfig]) => {
            acc[name] = {
              baseUrl: serverConfig.baseUrl,
            };
            return acc;
          },
          {} as Record<string, { baseUrl: string }>,
        ),
      };

      // Create ToolSet
      const toolset = await createToolSet(toolSetConfig);
      this._toolset = toolset;
      this._initialized = true;
      logger.info(`MCP toolset initialization completed: ${Object.keys(toolset.tools).length} tools loaded`);

      return toolset.tools;
    } catch (error) {
      logger.error('MCP toolset initialization error:', error);
      return {};
    }
  }

  /**
   * Returns MCP toolset
   */
  get tools() {
    return this._toolset?.tools || {};
  }

  /**
   * Returns MCP clients
   */
  get clients() {
    return this._toolset?.clients || {};
  }
}

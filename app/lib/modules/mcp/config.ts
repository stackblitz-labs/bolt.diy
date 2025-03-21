/**
 * Type definitions related to MCP(Model Context Protocol) configuration
 */

/**
 * MCP server configuration interface
 */
export interface MCPServerConfig {
  baseUrl: string;
}

/**
 * MCP global configuration interface
 */
export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

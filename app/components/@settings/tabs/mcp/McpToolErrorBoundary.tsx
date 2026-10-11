import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('mcp-tool-error-boundary');

type Props = {
  toolName: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Keeps one unrenderable tool from taking the whole MCP settings tab down with it. Tool
 * schemas come from third-party servers, so they are not worth trusting even after the
 * defensive parsing in mcpToolSchema.
 */
export default class McpToolErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(`Failed to render MCP tool "${this.props.toolName}":`, error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mt-2 ml-4 p-3 rounded-md bg-bolt-elements-background-depth-2 text-xs">
          <h3 className="text-bolt-elements-textPrimary font-semibold truncate" title={this.props.toolName}>
            {this.props.toolName}
          </h3>
          <p className="mt-1.5 text-red-600 dark:text-red-400">This tool&apos;s schema could not be displayed.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

import { describeMcpTool } from '~/components/@settings/tabs/mcp/mcpToolSchema';

type McpToolProps = {
  toolName: string;

  /*
   * Not typed as `Tool`: these arrive as JSON from /api/mcp-update-config, so the runtime
   * value is a plain object missing everything the AI SDK types promise.
   */
  toolSchema: unknown;
};

export default function McpServerListItem({ toolName, toolSchema }: McpToolProps) {
  if (!toolSchema) {
    return null;
  }

  const { description, parameters } = describeMcpTool(toolSchema);

  return (
    <div className="mt-2 ml-4 p-3 rounded-md bg-bolt-elements-background-depth-2 text-xs">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-bolt-elements-textPrimary font-semibold truncate" title={toolName}>
          {toolName}
        </h3>

        <p className="text-bolt-elements-textSecondary">{description || 'No description available'}</p>

        {parameters.length > 0 && (
          <div className="mt-2.5">
            <h4 className="text-bolt-elements-textSecondary font-semibold mb-1.5">Parameters:</h4>
            <ul className="ml-1 space-y-2">
              {parameters.map((parameter) => (
                <li key={parameter.name} className="break-words">
                  <div className="flex items-start">
                    <span className="font-medium text-bolt-elements-textPrimary">
                      {parameter.name}
                      {parameter.required && <span className="text-red-600 dark:text-red-400 ml-1">*</span>}
                    </span>

                    <span className="mx-2 text-bolt-elements-textSecondary">•</span>

                    <div className="flex-1">
                      {parameter.type && (
                        <span className="text-bolt-elements-textSecondary italic">{parameter.type}</span>
                      )}
                      {parameter.description && (
                        <div className="mt-0.5 text-bolt-elements-textSecondary">{parameter.description}</div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

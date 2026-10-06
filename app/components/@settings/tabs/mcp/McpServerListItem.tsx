import { asSchema, type Tool } from 'ai';

type ParameterProperty = {
  type?: string;
  description?: string;
};

type McpToolProps = {
  toolName: string;
  toolSchema: Tool;
};

export default function McpServerListItem({ toolName, toolSchema }: McpToolProps) {
  if (!toolSchema) {
    return null;
  }

  /*
   * v5 renamed `parameters` to `inputSchema` and dropped the local ToolParameters
   * shim in favour of asSchema, which normalises FlexibleSchema. The schema may
   * be async, hence the local widening at the use site below.
   */
  const { jsonSchema } = asSchema((toolSchema as { inputSchema: never }).inputSchema);
  const resolved = jsonSchema as { properties?: Record<string, ParameterProperty>; required?: string[] } | undefined;
  const parameters = resolved?.properties || {};
  const requiredParams = resolved?.required || [];

  /*
   * Tool is a four-way union in v5 and `description` may be a function of the
   * call context, which cannot be rendered directly.
   */
  const description = typeof toolSchema.description === 'string' ? toolSchema.description : undefined;

  return (
    <div className="mt-2 ml-4 p-3 rounded-md bg-bolt-elements-background-depth-2 text-xs">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-bolt-elements-textPrimary font-semibold truncate" title={toolName}>
          {toolName}
        </h3>

        <p className="text-bolt-elements-textSecondary">{description || 'No description available'}</p>

        {Object.keys(parameters).length > 0 && (
          <div className="mt-2.5">
            <h4 className="text-bolt-elements-textSecondary font-semibold mb-1.5">Parameters:</h4>
            <ul className="ml-1 space-y-2">
              {Object.entries(parameters).map(([paramName, paramDetails]) => (
                <li key={paramName} className="break-words">
                  <div className="flex items-start">
                    <span className="font-medium text-bolt-elements-textPrimary">
                      {paramName}
                      {requiredParams.includes(paramName) && (
                        <span className="text-red-600 dark:text-red-400 ml-1">*</span>
                      )}
                    </span>

                    <span className="mx-2 text-bolt-elements-textSecondary">•</span>

                    <div className="flex-1">
                      {paramDetails.type && (
                        <span className="text-bolt-elements-textSecondary italic">{paramDetails.type}</span>
                      )}
                      {paramDetails.description && (
                        <div className="mt-0.5 text-bolt-elements-textSecondary">{paramDetails.description}</div>
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

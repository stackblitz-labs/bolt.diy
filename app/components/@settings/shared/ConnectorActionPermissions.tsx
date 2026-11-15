import { useEffect } from 'react';
import { Switch } from '~/components/ui/Switch';
import { useMCPStore } from '~/lib/stores/mcp';

export type ConnectorPermissionId = 'github' | 'gitlab' | 'vercel' | 'netlify' | 'supabase';

export interface ConnectorPermissionAction {
  id: string;
  name: string;
  description: string;
}

export function getConnectorPermissionKey(connector: ConnectorPermissionId, actionId: string) {
  return `${connector}:${actionId}`;
}

interface ConnectorActionPermissionsProps {
  connector: ConnectorPermissionId;
  actions: ConnectorPermissionAction[];
}

export function ConnectorActionPermissions({ connector, actions }: ConnectorActionPermissionsProps) {
  const toolEnabled = useMCPStore((state) => state.settings.toolEnabled);
  const isInitialized = useMCPStore((state) => state.isInitialized);
  const initialize = useMCPStore((state) => state.initialize);
  const setToolEnabled = useMCPStore((state) => state.setToolEnabled);

  useEffect(() => {
    if (!isInitialized) {
      initialize().catch((error) => console.error('Could not load connector permissions:', error));
    }
  }, [initialize, isInitialized]);

  return (
    <section className="rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">Action permissions</h3>
        <p className="mt-1 text-xs text-bolt-elements-textSecondary">
          Choose which {connector[0].toUpperCase() + connector.slice(1)} actions Bolt can access.
        </p>
      </div>
      <div className="space-y-2">
        {actions.map((action) => {
          const key = getConnectorPermissionKey(connector, action.id);
          const enabled = toolEnabled[key] ?? true;

          return (
            <div
              key={action.id}
              className="flex items-center gap-3 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-bolt-elements-textPrimary">{action.name}</p>
                <p className="text-xs text-bolt-elements-textSecondary">{action.description}</p>
              </div>
              <Switch
                checked={enabled}
                aria-label={`${enabled ? 'Disable' : 'Enable'} ${action.name}`}
                onCheckedChange={(checked) => setToolEnabled(key, checked)}
                disabled={!isInitialized}
                className="shrink-0"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

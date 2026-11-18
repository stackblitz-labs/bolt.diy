import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/Collapsible';
import { classNames } from '~/utils/classNames';

export interface ResourceAction<T = any> {
  name: string;
  permissionId: string;
  icon: string;
  action: (resource: T) => Promise<void>;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  variant?: 'default' | 'destructive' | 'outline';
  isVisible?: (resource: T) => boolean;
}

export interface ResourceItem {
  id: string;
  name: string;
  description?: string;
  status?: string;
  statusVariant?:
    | 'default'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'subtle'
    | 'destructive';
  url?: string;
  metadata?: Record<string, any>;
  icon?: string;
  updatedAt?: string;
}

export interface ServiceResourceListProps<T extends ResourceItem = ResourceItem> {
  title: string;
  resources: T[];
  actions: ResourceAction<T>[];
  isExpanded: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  renderResourceCard?: (resource: T, actions: React.ReactNode) => React.ReactNode;
  permissionEnabled: (permissionId: string) => boolean;
}

export function ServiceResourceList<T extends ResourceItem = ResourceItem>({
  title,
  resources,
  actions,
  isExpanded,
  onToggle,
  isLoading = false,
  emptyMessage = 'No resources found',
  emptyIcon = 'i-ph:folder-open',
  renderResourceCard,
  permissionEnabled,
}: ServiceResourceListProps<T>) {
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());

  const handleAction = async (action: ResourceAction<T>, resource: T) => {
    if (action.requiresConfirmation) {
      const confirmed = window.confirm(
        action.confirmationMessage || `Are you sure you want to ${action.name.toLowerCase()} "${resource.name}"?`,
      );

      if (!confirmed) {
        return;
      }
    }

    const actionKey = `${resource.id}-${action.permissionId}`;
    setLoadingActions((prev) => new Set(prev).add(actionKey));

    try {
      await action.action(resource);
    } catch (error) {
      toast.error(
        `Failed to ${action.name.toLowerCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev);
        next.delete(actionKey);

        return next;
      });
    }
  };

  const renderActions = (resource: T) => {
    const visibleActions = actions.filter(
      (action) => permissionEnabled(action.permissionId) && (!action.isVisible || action.isVisible(resource)),
    );

    if (visibleActions.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action) => {
          const actionKey = `${resource.id}-${action.permissionId}`;
          const isLoading = loadingActions.has(actionKey);

          return (
            <Button
              key={action.permissionId}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={() => handleAction(action, resource)}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="i-ph:spinner animate-spin mr-1" />
              ) : (
                <span className={classNames(action.icon, 'mr-1')} />
              )}
              {action.name}
            </Button>
          );
        })}
      </div>
    );
  };

  const renderDefaultCard = (resource: T) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      key={resource.id}
      className="p-4 bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor rounded-lg hover:border-bolt-elements-focus transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {resource.icon && <span className={classNames(resource.icon, 'text-lg')} />}
            <h4 className="font-medium text-bolt-elements-textPrimary truncate">{resource.name}</h4>
            {resource.status && <Badge variant={resource.statusVariant || 'default'}>{resource.status}</Badge>}
          </div>
          {resource.description && (
            <p className="text-sm text-bolt-elements-textSecondary mb-3">{resource.description}</p>
          )}
          {resource.url && (
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent-light hover:underline inline-flex items-center gap-1"
            >
              {resource.url}
              <span className="i-ph:arrow-square-out" />
            </a>
          )}
          {resource.updatedAt && (
            <p className="text-xs text-bolt-elements-textTertiary mt-2">Updated {resource.updatedAt}</p>
          )}
        </div>
        <div className="flex-shrink-0">{renderActions(resource)}</div>
      </div>
    </motion.div>
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-bolt-elements-borderColor rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-4 hover:bg-bolt-elements-bg-depth-2 transition-colors">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{title}</h3>
              {!isLoading && resources.length > 0 && <Badge variant="default">{resources.length}</Badge>}
            </div>
            <ChevronDown
              className={classNames(
                'w-5 h-5 text-bolt-elements-textSecondary transition-transform',
                isExpanded && 'rotate-180',
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-bolt-elements-borderColor"
          >
            {isLoading ? (
              <div className="p-6">
                <div className="flex items-center justify-center py-8">
                  <div className="i-ph:spinner animate-spin text-2xl text-bolt-elements-textSecondary" />
                </div>
              </div>
            ) : resources.length === 0 ? (
              <div className="p-6">
                <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textSecondary">
                  <span className={classNames(emptyIcon, 'text-4xl mb-3')} />
                  <p>{emptyMessage}</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {resources.map((resource) =>
                  renderResourceCard
                    ? renderResourceCard(resource, renderActions(resource))
                    : renderDefaultCard(resource),
                )}
              </div>
            )}
          </motion.div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

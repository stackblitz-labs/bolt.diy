import React from 'react';
import { AppCard } from './AppCard';
import { type AppSummary } from '~/lib/persistence/messageAppSummary';
import { CheckCircle, Circle, MoreHorizontal, Key } from '~/components/ui/Icon';

interface SecretsCardProps {
  appSummary: AppSummary;
  onViewDetails: () => void;
}

const BUILTIN_SECRET_NAMES = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

export const SecretsCard: React.FC<SecretsCardProps> = ({ appSummary, onViewDetails }) => {
  const allSecrets = appSummary?.features?.flatMap((f) => f.secrets ?? []) ?? [];
  const setSecrets = appSummary?.setSecrets || [];

  const requiredSecrets = allSecrets.filter((secret) => !BUILTIN_SECRET_NAMES.includes(secret.name));
  const setRequiredSecrets = requiredSecrets.filter((secret) => setSecrets.includes(secret.name));

  const getStatusInfo = () => {
    if (requiredSecrets.length === 0) {
      return {
        status: 'completed' as const,
        progressText: 'No configuration needed',
      };
    }

    if (setRequiredSecrets.length === requiredSecrets.length) {
      return {
        status: 'completed' as const,
        progressText: 'All secrets configured',
      };
    }

    if (setRequiredSecrets.length > 0) {
      return {
        status: 'in-progress' as const,
        progressText: `${setRequiredSecrets.length}/${requiredSecrets.length} configured`,
      };
    }

    return {
      status: 'pending' as const,
      progressText: 'Configuration required',
    };
  };

  const statusInfo = getStatusInfo();

  const getDescription = () => {
    if (allSecrets.length === 0) {
      return 'No secrets required for this application';
    }

    const builtinCount = allSecrets.filter((s) => BUILTIN_SECRET_NAMES.includes(s.name)).length;
    const requiredCount = requiredSecrets.length;

    if (requiredCount === 0 && builtinCount > 0) {
      return `Uses ${builtinCount} built-in secret${builtinCount === 1 ? '' : 's'}`;
    }

    if (requiredCount > 0 && builtinCount > 0) {
      return `${requiredCount} secret${requiredCount === 1 ? '' : 's'} to configure, ${builtinCount} built-in`;
    }

    return `${requiredCount} secret${requiredCount === 1 ? '' : 's'} need${requiredCount === 1 ? 's' : ''} configuration`;
  };

  const getSecretsList = () => {
    if (allSecrets.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2">
        {/* Required Secrets List */}
        {requiredSecrets.slice(0, 5).map((secret, index) => (
          <div key={index} className="flex items-center gap-2 py-1">
            {setSecrets.includes(secret.name) ? (
              <CheckCircle className="text-green-500 flex-shrink-0" size={14} />
            ) : (
              <Circle className="text-bolt-elements-textSecondary flex-shrink-0" size={14} />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">{secret.name}</div>
              {secret.description && (
                <div className="text-xs text-bolt-elements-textSecondary truncate">{secret.description}</div>
              )}
            </div>
          </div>
        ))}

        {/* Show remaining count if more than 5 */}
        {requiredSecrets.length > 5 && (
          <div className="flex items-center gap-2 py-1 text-xs text-bolt-elements-textSecondary">
            <MoreHorizontal className="flex-shrink-0" size={14} />
            <span>
              and {requiredSecrets.length - 5} more secret{requiredSecrets.length - 5 === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {/* Built-in secrets info */}
        {allSecrets.filter((s) => BUILTIN_SECRET_NAMES.includes(s.name)).length > 0 && (
          <div className="flex items-center gap-2 py-1 mt-2 pt-2 border-t border-bolt-elements-borderColor border-opacity-30">
            <CheckCircle className="text-green-500 flex-shrink-0" size={14} />
            <span className="text-xs text-bolt-elements-textSecondary">Built-in API keys configured automatically</span>
          </div>
        )}
      </div>
    );
  };

  // Only show card if there are secrets
  if (allSecrets.length === 0) {
    return null;
  }

  return (
    <AppCard
      title="Secrets Configuration"
      description={getDescription()}
      icon={<Key className="text-white" size={18} />}
      iconColor="purple"
      status={statusInfo.status}
      progressText={statusInfo.progressText}
      onClick={onViewDetails}
    >
      {getSecretsList()}
    </AppCard>
  );
};

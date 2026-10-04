// Remove unused imports
import React, { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '~/components/ui/Switch';
import { useSettings } from '~/lib/hooks/useSettings';
import { classNames } from '~/utils/classNames';
import { toast } from 'react-toastify';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { isMac } from '~/utils/os';
import type { Shortcut, Shortcuts } from '~/lib/stores/settings';

interface FeatureToggle {
  id: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  beta?: boolean;
  experimental?: boolean;
  tooltip?: string;
}

const FeatureCard = memo(
  ({
    feature,
    index,
    onToggle,
  }: {
    feature: FeatureToggle;
    index: number;
    onToggle: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      key={feature.id}
      layoutId={feature.id}
      className={classNames(
        'relative group cursor-pointer',
        'bg-bolt-elements-background-depth-2',
        'hover:bg-bolt-elements-background-depth-3',
        'transition-colors duration-200',
        'rounded-lg overflow-hidden',
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={classNames(feature.icon, 'w-5 h-5 text-bolt-elements-textSecondary')} />
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-bolt-elements-textPrimary">{feature.title}</h4>
              {feature.beta && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500 font-medium">Beta</span>
              )}
              {feature.experimental && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-500 font-medium">
                  Experimental
                </span>
              )}
            </div>
          </div>
          <Switch checked={feature.enabled} onCheckedChange={(checked) => onToggle(feature.id, checked)} />
        </div>
        <p className="mt-2 text-sm text-bolt-elements-textSecondary">{feature.description}</p>
        {feature.tooltip && <p className="mt-1 text-xs text-bolt-elements-textTertiary">{feature.tooltip}</p>}
      </div>
    </motion.div>
  ),
);

const FeatureSection = memo(
  ({
    title,
    features,
    icon,
    description,
    onToggleFeature,
  }: {
    title: string;
    features: FeatureToggle[];
    icon: string;
    description: string;
    onToggleFeature: (id: string, enabled: boolean) => void;
  }) => (
    <motion.div
      layout
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3">
        <div className={classNames(icon, 'text-xl text-purple-500')} />
        <div>
          <h3 className="text-lg font-medium text-bolt-elements-textPrimary">{title}</h3>
          <p className="text-sm text-bolt-elements-textSecondary">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature, index) => (
          <FeatureCard key={feature.id} feature={feature} index={index} onToggle={onToggleFeature} />
        ))}
      </div>
    </motion.div>
  ),
);

export default function FeaturesTab() {
  const {
    autoSelectTemplate,
    isLatestBranch,
    contextOptimizationEnabled,
    eventLogs,
    autoPromptEnhancement,
    confirmFileWrites,
    performanceMode,
    agentMode,
    frameworkLock,
    shortcuts,
    setAutoSelectTemplate,
    enableLatestBranch,
    enableContextOptimization,
    setEventLogs,
    setAutoPromptEnhancement,
    setConfirmFileWrites,
    setPerformanceMode,
    setAgentMode,
    setFrameworkLock,
    updateShortcutBinding,
    resetShortcuts,
    setPromptId,
    promptId,
  } = useSettings();

  const [recordingShortcut, setRecordingShortcut] = React.useState<keyof Shortcuts | null>(null);

  const formatShortcutKey = (key: string) => {
    if (key === ' ') {
      return 'Space';
    }

    if (key === 'Escape') {
      return 'Esc';
    }

    return key.length === 1 ? key.toUpperCase() : key;
  };

  const formatShortcut = (shortcut: Shortcut) => {
    const parts: string[] = [];

    if (shortcut.ctrlOrMetaKey) {
      parts.push(isMac ? 'Cmd' : 'Ctrl');
    } else {
      if (shortcut.ctrlKey) {
        parts.push('Ctrl');
      }

      if (shortcut.metaKey) {
        parts.push('Cmd');
      }
    }

    if (shortcut.altKey) {
      parts.push(isMac ? 'Option' : 'Alt');
    }

    if (shortcut.shiftKey) {
      parts.push('Shift');
    }

    parts.push(formatShortcutKey(shortcut.key));

    return parts.join(' + ');
  };

  // Enable features by default on first load
  React.useEffect(() => {
    // Only set defaults if values are undefined
    if (isLatestBranch === undefined) {
      enableLatestBranch(false); // Default: OFF - Don't auto-update from main branch
    }

    if (contextOptimizationEnabled === undefined) {
      enableContextOptimization(true); // Default: ON - Enable context optimization
    }

    if (autoSelectTemplate === undefined) {
      setAutoSelectTemplate(true); // Default: ON - Enable auto-select templates
    }

    if (promptId === undefined) {
      setPromptId('default'); // Default: 'default'
    }

    if (eventLogs === undefined) {
      setEventLogs(true); // Default: ON - Enable event logging
    }
  }, []); // Only run once on component mount

  const handleToggleFeature = useCallback(
    (id: string, enabled: boolean) => {
      switch (id) {
        case 'latestBranch': {
          enableLatestBranch(enabled);
          toast.success(`Main branch updates ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'autoSelectTemplate': {
          setAutoSelectTemplate(enabled);
          toast.success(`Auto select template ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'contextOptimization': {
          enableContextOptimization(enabled);
          toast.success(`Context optimization ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        case 'eventLogs': {
          setEventLogs(enabled);
          toast.success(`Event logging ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }
        case 'autoPromptEnhancement': {
          setAutoPromptEnhancement(enabled);
          toast.success(`Auto prompt enhancement ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }
        case 'confirmFileWrites': {
          setConfirmFileWrites(enabled);
          toast.success(`Confirm file writes ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }
        case 'performanceMode': {
          setPerformanceMode(enabled);
          toast.success(`Performance mode ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }
        case 'agentMode': {
          setAgentMode(enabled);
          toast.success(`Agent mode ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }
        case 'frameworkLock': {
          setFrameworkLock(enabled);
          toast.success(`Framework lock ${enabled ? 'enabled' : 'disabled'}`);
          break;
        }

        default:
          break;
      }
    },
    [
      enableLatestBranch,
      setAutoSelectTemplate,
      enableContextOptimization,
      setEventLogs,
      setAutoPromptEnhancement,
      setConfirmFileWrites,
      setPerformanceMode,
      setAgentMode,
      setFrameworkLock,
    ],
  );

  const features = {
    stable: [
      {
        id: 'latestBranch',
        title: 'Main Branch Updates',
        description: 'Get the latest updates from the main branch',
        icon: 'i-ph:git-branch',
        enabled: isLatestBranch,
        tooltip: 'Enabled by default to receive updates from the main development branch',
      },
      {
        id: 'autoSelectTemplate',
        title: 'Auto Select Template',
        description: 'Automatically select starter template',
        icon: 'i-ph:selection',
        enabled: autoSelectTemplate,
        tooltip: 'Enabled by default to automatically select the most appropriate starter template',
      },
      {
        id: 'contextOptimization',
        title: 'Context Optimization',
        description: 'Optimize context for better responses',
        icon: 'i-ph:brain',
        enabled: contextOptimizationEnabled,
        tooltip: 'Enabled by default for improved AI responses',
      },
      {
        id: 'eventLogs',
        title: 'Event Logging',
        description: 'Enable detailed event logging and history',
        icon: 'i-ph:list-bullets',
        enabled: eventLogs,
        tooltip: 'Enabled by default to record detailed logs of system events and user actions',
      },
      {
        id: 'autoPromptEnhancement',
        title: 'Auto Prompt Enhancement',
        description: 'Automatically enhance prompts before sending',
        icon: 'i-bolt:stars',
        enabled: autoPromptEnhancement,
        beta: true,
        tooltip: 'Adds an extra LLM step to refine prompts for clarity and completeness',
      },
      {
        id: 'confirmFileWrites',
        title: 'Confirm File Changes',
        description: 'Require approval before applying file edits',
        icon: 'i-ph:git-diff',
        enabled: confirmFileWrites,
        beta: true,
        tooltip: 'Stages AI file changes for review, similar to git confirmations',
      },
      {
        id: 'performanceMode',
        title: 'Performance Mode',
        description: 'Reduce visual effects for better performance',
        icon: 'i-ph:speedometer',
        enabled: performanceMode,
        tooltip: 'Disables heavy visuals and blur effects to reduce CPU/GPU usage',
      },
      {
        id: 'agentMode',
        title: 'Agent Mode',
        description: 'Run a planning step before responses',
        icon: 'i-ph:robot',
        enabled: agentMode,
        experimental: true,
        tooltip: 'Adds a backend planning step to improve multi-step task execution',
      },
      {
        id: 'frameworkLock',
        title: 'Framework Lock',
        description: 'Keep the AI aligned with the detected project framework',
        icon: 'i-ph:lock',
        enabled: frameworkLock,
        tooltip: 'Injects a framework hint so the assistant does not drift to other stacks',
      },
    ],
    beta: [],
  };

  const shortcutEntries: Array<{ id: keyof Shortcuts; title: string; description: string }> = [
    {
      id: 'toggleTheme',
      title: 'Toggle Theme',
      description: 'Switch between light and dark themes',
    },
    {
      id: 'toggleTerminal',
      title: 'Toggle Terminal',
      description: 'Show or hide the terminal panel',
    },
  ];

  React.useEffect(() => {
    if (!recordingShortcut) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
        return;
      }

      event.preventDefault();
      updateShortcutBinding(recordingShortcut, {
        key: event.key,
        ctrlKey: event.ctrlKey || undefined,
        metaKey: event.metaKey || undefined,
        altKey: event.altKey || undefined,
        shiftKey: event.shiftKey || undefined,
        ctrlOrMetaKey: undefined,
      });
      setRecordingShortcut(null);
      toast.success('Shortcut updated');
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recordingShortcut, updateShortcutBinding]);

  return (
    <div className="flex flex-col gap-8">
      <FeatureSection
        title="Core Features"
        features={features.stable}
        icon="i-ph:check-circle"
        description="Essential features that are enabled by default for optimal performance"
        onToggleFeature={handleToggleFeature}
      />

      {features.beta.length > 0 && (
        <FeatureSection
          title="Beta Features"
          features={features.beta}
          icon="i-ph:test-tube"
          description="New features that are ready for testing but may have some rough edges"
          onToggleFeature={handleToggleFeature}
        />
      )}

      <motion.div
        layout
        className={classNames(
          'bg-bolt-elements-background-depth-2',
          'hover:bg-bolt-elements-background-depth-3',
          'transition-all duration-200',
          'rounded-lg p-4',
          'group',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <div
            className={classNames(
              'p-2 rounded-lg text-xl',
              'bg-bolt-elements-background-depth-3 group-hover:bg-bolt-elements-background-depth-4',
              'transition-colors duration-200',
              'text-purple-500',
            )}
          >
            <div className="i-ph:book" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-purple-500 transition-colors">
              Prompt Library
            </h4>
            <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
              Choose a prompt from the library to use as the system prompt
            </p>
          </div>
          <select
            value={promptId}
            onChange={(e) => {
              setPromptId(e.target.value);
              toast.success('Prompt template updated');
            }}
            className={classNames(
              'p-2 rounded-lg text-sm min-w-[200px]',
              'bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
              'group-hover:border-purple-500/30',
              'transition-all duration-200',
            )}
          >
            {PromptLibrary.getList().map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      <motion.div
        layout
        className={classNames(
          'bg-bolt-elements-background-depth-2',
          'hover:bg-bolt-elements-background-depth-3',
          'transition-all duration-200',
          'rounded-lg p-4',
          'group',
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center gap-4">
          <div
            className={classNames(
              'p-2 rounded-lg text-xl',
              'bg-bolt-elements-background-depth-3 group-hover:bg-bolt-elements-background-depth-4',
              'transition-colors duration-200',
              'text-purple-500',
            )}
          >
            <div className="i-ph:keyboard" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-bolt-elements-textPrimary group-hover:text-purple-500 transition-colors">
              Keyboard Shortcuts
            </h4>
            <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
              Record custom shortcuts for common actions
            </p>
          </div>
          <button
            className={classNames(
              'px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-bolt-elements-button-secondary-background',
              'hover:bg-bolt-elements-button-secondary-backgroundHover',
              'text-bolt-elements-button-secondary-text',
              'transition-colors duration-200',
            )}
            onClick={() => {
              resetShortcuts();
              toast.success('Shortcuts reset to defaults');
            }}
          >
            Reset
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {shortcutEntries.map((entry) => {
            const shortcut = shortcuts[entry.id];
            const isRecording = recordingShortcut === entry.id;

            return (
              <div
                key={entry.id}
                className={classNames(
                  'rounded-lg p-3',
                  'bg-bolt-elements-background-depth-3',
                  'border border-bolt-elements-borderColor',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-bolt-elements-textPrimary">{entry.title}</div>
                    <div className="text-xs text-bolt-elements-textSecondary">{entry.description}</div>
                  </div>
                  <button
                    className={classNames(
                      'px-2.5 py-1 rounded-md text-xs font-medium',
                      isRecording
                        ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
                        : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary',
                    )}
                    onClick={() => setRecordingShortcut(isRecording ? null : entry.id)}
                  >
                    {isRecording ? 'Press keys…' : 'Record'}
                  </button>
                </div>
                <div className="mt-2 text-xs text-bolt-elements-textSecondary">
                  Current: <span className="font-mono">{formatShortcut(shortcut)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

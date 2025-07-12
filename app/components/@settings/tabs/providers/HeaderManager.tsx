import React, { useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { IProviderSetting } from '~/types/model';
import { classNames } from '~/utils/classNames';
import { motion, AnimatePresence } from 'framer-motion';

interface HeaderManagerProps {
  provider: string;
  settings: IProviderSetting;
  onUpdateSettings: (settings: IProviderSetting) => void;
}

interface HeaderFormData {
  name: string;
  value: string;
}

export const HeaderManager: React.FC<HeaderManagerProps> = ({ provider, settings, onUpdateSettings }) => {
  const [isAddingHeader, setIsAddingHeader] = useState(false);
  const [editingHeaderKey, setEditingHeaderKey] = useState<string | null>(null);
  const [headerForm, setHeaderForm] = useState<HeaderFormData>({
    name: '',
    value: '',
  });

  const customHeaders = settings.customHeaders || {};
  const headerEntries = Object.entries(customHeaders);

  const handleAddHeader = () => {
    if (!headerForm.name.trim() || !headerForm.value.trim()) {
      return;
    }

    const updatedHeaders = {
      ...customHeaders,
      [headerForm.name.trim()]: headerForm.value.trim(),
    };

    const updatedSettings = {
      ...settings,
      customHeaders: updatedHeaders,
    };

    onUpdateSettings(updatedSettings);
    setHeaderForm({ name: '', value: '' });
    setIsAddingHeader(false);
  };

  const handleEditHeader = (key: string) => {
    setHeaderForm({
      name: key,
      value: customHeaders[key],
    });
    setEditingHeaderKey(key);
  };

  const handleUpdateHeader = () => {
    if (editingHeaderKey === null || !headerForm.name.trim() || !headerForm.value.trim()) {
      return;
    }

    const updatedHeaders = { ...customHeaders };

    // Remove old key if name changed
    if (editingHeaderKey !== headerForm.name.trim()) {
      delete updatedHeaders[editingHeaderKey];
    }

    // Add/update with new values
    updatedHeaders[headerForm.name.trim()] = headerForm.value.trim();

    const updatedSettings = {
      ...settings,
      customHeaders: updatedHeaders,
    };

    onUpdateSettings(updatedSettings);
    setHeaderForm({ name: '', value: '' });
    setEditingHeaderKey(null);
  };

  const handleDeleteHeader = (key: string) => {
    const updatedHeaders = { ...customHeaders };
    delete updatedHeaders[key];

    const updatedSettings = {
      ...settings,
      customHeaders: updatedHeaders,
    };
    onUpdateSettings(updatedSettings);
  };

  const handleCancelEdit = () => {
    setHeaderForm({ name: '', value: '' });
    setIsAddingHeader(false);
    setEditingHeaderKey(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Custom Headers</h4>
        <IconButton
          onClick={() => setIsAddingHeader(true)}
          title="Add Header"
          className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
          disabled={isAddingHeader || editingHeaderKey !== null}
        >
          <div className="i-ph:plus w-4 h-4" />
        </IconButton>
      </div>

      {/* Header Form */}
      <AnimatePresence>
        {(isAddingHeader || editingHeaderKey !== null) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border border-bolt-elements-borderColor rounded-lg p-4 bg-bolt-elements-background-depth-3"
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">Header Name</label>
                  <input
                    type="text"
                    value={headerForm.name}
                    onChange={(e) => setHeaderForm({ ...headerForm, name: e.target.value })}
                    placeholder="e.g., x-api-version"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">
                    Header Value
                  </label>
                  <input
                    type="text"
                    value={headerForm.value}
                    onChange={(e) => setHeaderForm({ ...headerForm, value: e.target.value })}
                    placeholder="e.g., v1.0"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                    )}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <IconButton
                  onClick={handleCancelEdit}
                  title="Cancel"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
                >
                  <div className="i-ph:x w-4 h-4" />
                </IconButton>
                <IconButton
                  onClick={editingHeaderKey !== null ? handleUpdateHeader : handleAddHeader}
                  title={editingHeaderKey !== null ? 'Update Header' : 'Add Header'}
                  className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
                  disabled={!headerForm.name.trim() || !headerForm.value.trim()}
                >
                  <div className="i-ph:check w-4 h-4" />
                </IconButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Headers List */}
      <div className="space-y-2">
        <AnimatePresence>
          {headerEntries.map(([key, value]) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={classNames(
                'flex items-center justify-between p-3 rounded-lg',
                'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                'hover:bg-bolt-elements-background-depth-3 transition-colors',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-bolt-elements-textPrimary truncate">{key}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">{value}</span>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary mt-0.5">Custom header for {provider}</p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  onClick={() => handleEditHeader(key)}
                  title="Edit Header"
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
                  disabled={isAddingHeader || editingHeaderKey !== null}
                >
                  <div className="i-ph:pencil-simple w-4 h-4" />
                </IconButton>
                <IconButton
                  onClick={() => handleDeleteHeader(key)}
                  title="Delete Header"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
                  disabled={isAddingHeader || editingHeaderKey !== null}
                >
                  <div className="i-ph:trash w-4 h-4" />
                </IconButton>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {headerEntries.length === 0 && !isAddingHeader && (
          <div className="text-center py-8 text-bolt-elements-textSecondary">
            <div className="i-ph:list-dashes w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No custom headers configured</p>
            <p className="text-xs mt-1">Click the + button to add a header</p>
            {provider === 'Portkey' && <p className="text-xs mt-2 text-purple-500">Default: x-portkey-debug: false</p>}
          </div>
        )}
      </div>
    </div>
  );
};

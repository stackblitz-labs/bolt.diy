import React, { useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import { classNames } from '~/utils/classNames';
import { motion, AnimatePresence } from 'framer-motion';

interface ModelManagerProps {
  provider: string;
  settings: IProviderSetting;
  onUpdateSettings: (settings: IProviderSetting) => void;
}

interface ModelFormData {
  name: string;
  label: string;
  maxTokenAllowed: number;
}

export const ModelManager: React.FC<ModelManagerProps> = ({ provider, settings, onUpdateSettings }) => {
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
  const [modelForm, setModelForm] = useState<ModelFormData>({
    name: '',
    label: '',
    maxTokenAllowed: 8000,
  });

  const customModels = settings.customModels || [];

  const handleAddModel = () => {
    if (!modelForm.name.trim() || !modelForm.label.trim()) {
      return;
    }

    const newModel: ModelInfo = {
      name: modelForm.name.trim(),
      label: modelForm.label.trim(),
      provider,
      maxTokenAllowed: modelForm.maxTokenAllowed,
    };

    const updatedSettings = {
      ...settings,
      customModels: [...customModels, newModel],
    };

    onUpdateSettings(updatedSettings);
    setModelForm({ name: '', label: '', maxTokenAllowed: 8000 });
    setIsAddingModel(false);
  };

  const handleEditModel = (index: number) => {
    const model = customModels[index];
    setModelForm({
      name: model.name,
      label: model.label,
      maxTokenAllowed: model.maxTokenAllowed,
    });
    setEditingModelIndex(index);
  };

  const handleUpdateModel = () => {
    if (editingModelIndex === null || !modelForm.name.trim() || !modelForm.label.trim()) {
      return;
    }

    const updatedModels = [...customModels];
    updatedModels[editingModelIndex] = {
      name: modelForm.name.trim(),
      label: modelForm.label.trim(),
      provider,
      maxTokenAllowed: modelForm.maxTokenAllowed,
    };

    const updatedSettings = {
      ...settings,
      customModels: updatedModels,
    };

    onUpdateSettings(updatedSettings);
    setModelForm({ name: '', label: '', maxTokenAllowed: 8000 });
    setEditingModelIndex(null);
  };

  const handleDeleteModel = (index: number) => {
    const updatedModels = customModels.filter((_, i) => i !== index);
    const updatedSettings = {
      ...settings,
      customModels: updatedModels,
    };
    onUpdateSettings(updatedSettings);
  };

  const handleCancelEdit = () => {
    setModelForm({ name: '', label: '', maxTokenAllowed: 8000 });
    setIsAddingModel(false);
    setEditingModelIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Custom Models</h4>
        <IconButton
          onClick={() => setIsAddingModel(true)}
          title="Add Model"
          className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
          disabled={isAddingModel || editingModelIndex !== null}
        >
          <div className="i-ph:plus w-4 h-4" />
        </IconButton>
      </div>

      {/* Model Form */}
      <AnimatePresence>
        {(isAddingModel || editingModelIndex !== null) && (
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
                  <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">Model Name</label>
                  <input
                    type="text"
                    value={modelForm.name}
                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                    placeholder="e.g., gpt-4o"
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
                    Display Label
                  </label>
                  <input
                    type="text"
                    value={modelForm.label}
                    onChange={(e) => setModelForm({ ...modelForm, label: e.target.value })}
                    placeholder="e.g., GPT-4o (via Portkey)"
                    className={classNames(
                      'w-full px-3 py-2 rounded-lg text-sm',
                      'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                      'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                      'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                    )}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1">Max Tokens</label>
                <input
                  type="number"
                  value={modelForm.maxTokenAllowed}
                  onChange={(e) => setModelForm({ ...modelForm, maxTokenAllowed: parseInt(e.target.value) || 8000 })}
                  min="1000"
                  max="2000000"
                  className={classNames(
                    'w-full px-3 py-2 rounded-lg text-sm',
                    'bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                    'text-bolt-elements-textPrimary',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500/30',
                  )}
                />
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
                  onClick={editingModelIndex !== null ? handleUpdateModel : handleAddModel}
                  title={editingModelIndex !== null ? 'Update Model' : 'Add Model'}
                  className="bg-green-500/10 hover:bg-green-500/20 text-green-500"
                  disabled={!modelForm.name.trim() || !modelForm.label.trim()}
                >
                  <div className="i-ph:check w-4 h-4" />
                </IconButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model List */}
      <div className="space-y-2">
        <AnimatePresence>
          {customModels.map((model, index) => (
            <motion.div
              key={`${model.name}-${index}`}
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
                  <span className="text-sm font-medium text-bolt-elements-textPrimary truncate">{model.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-500">{model.name}</span>
                </div>
                <p className="text-xs text-bolt-elements-textSecondary mt-0.5">
                  Max tokens: {model.maxTokenAllowed.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  onClick={() => handleEditModel(index)}
                  title="Edit Model"
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-500"
                  disabled={isAddingModel || editingModelIndex !== null}
                >
                  <div className="i-ph:pencil-simple w-4 h-4" />
                </IconButton>
                <IconButton
                  onClick={() => handleDeleteModel(index)}
                  title="Delete Model"
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-500"
                  disabled={isAddingModel || editingModelIndex !== null}
                >
                  <div className="i-ph:trash w-4 h-4" />
                </IconButton>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {customModels.length === 0 && !isAddingModel && (
          <div className="text-center py-8 text-bolt-elements-textSecondary">
            <div className="i-ph:list-dashes w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No custom models configured</p>
            <p className="text-xs mt-1">Click the + button to add a model</p>
          </div>
        )}
      </div>
    </div>
  );
};

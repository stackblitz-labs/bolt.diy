import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { PromptLibrary, type CustomPrompt } from '~/lib/common/prompt-library';
import { Dialog, DialogRoot, DialogTitle, DialogDescription, DialogButton } from '~/components/ui/Dialog';
import { Switch } from '~/components/ui/Switch';
import { ScrollArea } from '~/components/ui/ScrollArea';
import { useSettings } from '~/lib/hooks/useSettings';
import { logStore } from '~/lib/stores/logs';

interface PromptFormData {
  label: string;
  description: string;
  content: string;
  category: string;
}

export default function PromptLibraryTab() {
  const { promptId, setPromptId } = useSettings();
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<{id: string; label: string; description: string; category: string}[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<CustomPrompt | null>(null);
  const [deletePromptId, setDeletePromptId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromptFormData>({
    label: '',
    description: '',
    content: '',
    category: 'Custom',
  });
  const [customCategory, setCustomCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [promptStates, setPromptStates] = useState<Record<string, boolean>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<PromptFormData>({
    label: '',
    description: '',
    content: '',
    category: '',
  });

  // Load prompts on mount
  useEffect(() => {
    loadPrompts();
  }, []);

  // Load and process prompts
  const loadPrompts = () => {
    const system = PromptLibrary.getList();
    setSystemPrompts(system);
    
    const custom = PromptLibrary.getCustomPrompts();
    setCustomPrompts(custom);
    
    setCategories(PromptLibrary.getCategories());

    // Initialize prompt states
    const states: Record<string, boolean> = {};
    [...system, ...custom].forEach(prompt => {
      states[prompt.id] = prompt.id === promptId;
    });
    setPromptStates(states);
  };

  // Filter prompts by category
  const getFilteredPrompts = () => {
    const filtered = {
      system: systemPrompts.filter(p => !activeCategory || p.category === activeCategory),
      custom: customPrompts.filter(p => !activeCategory || p.category === activeCategory)
    };
    return filtered;
  };

  const handleAddPrompt = () => {
    try {
      if (!formData.label.trim()) {
        toast.error('Prompt name is required');
        return;
      }

      if (!formData.content.trim()) {
        toast.error('Prompt content is required');
        return;
      }

      const category = formData.category === 'custom' ? customCategory : formData.category;
      
      if (formData.category === 'custom' && !customCategory.trim()) {
        toast.error('Category name is required');
        return;
      }

      const newPrompt = PromptLibrary.addCustomPrompt({
        label: formData.label.trim(),
        description: formData.description.trim() || 'No description provided',
        content: formData.content.trim(),
        category: category.trim(),
      });

      logStore.logSystem(`Added new prompt: ${newPrompt.label}`);

      setFormData({
        label: '',
        description: '',
        content: '',
        category: 'Custom',
      });
      setCustomCategory('');
      setShowAddDialog(false);
      loadPrompts();
      toast.success('Prompt added successfully');
    } catch (error) {
      console.error('Error adding prompt:', error);
      toast.error('Failed to add prompt');
    }
  };

  const handleConfirmDelete = () => {
    try {
      if (!deletePromptId) return;
      
      const promptToDelete = customPrompts.find(p => p.id === deletePromptId);
      
      if (!promptToDelete) {
        toast.error('Prompt not found');
        return;
      }

      if (deletePromptId === promptId) {
        setPromptId('default');
        toast.info('Switched to default prompt as the current prompt was deleted');
      }

      PromptLibrary.deleteCustomPrompt(deletePromptId);
      logStore.logSystem(`Deleted prompt: ${promptToDelete.label}`);
      
      setDeletePromptId(null);
      setShowDeleteDialog(false);
      loadPrompts();
      
      toast.success('Prompt deleted successfully');
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    }
  };

  const handleTogglePromptState = (id: string) => {
    setPromptStates(prev => {
      const newStates = { ...prev, [id]: !prev[id] };
      if (newStates[id]) {
        setPromptId(id);
        toast.success('Prompt activated successfully');
      } else if (id === promptId) {
        setPromptId('default');
        toast.info('Switched to default prompt');
      }
      return newStates;
    });
  };

  // Handle editing prompt
  const handleEditPrompt = () => {
    try {
      if (!selectedPrompt) return;

      if (!editFormData.label.trim()) {
        toast.error('Prompt name is required');
        return;
      }

      if (!editFormData.content.trim()) {
        toast.error('Prompt content is required');
        return;
      }

      PromptLibrary.updateCustomPrompt(selectedPrompt.id, {
        label: editFormData.label.trim(),
        description: editFormData.description.trim() || 'No description provided',
        content: editFormData.content.trim(),
        category: editFormData.category.trim(),
      });

      logStore.logSystem(`Updated prompt: ${editFormData.label}`);
      
      setIsEditing(false);
      setShowViewDialog(false);
      loadPrompts();
      toast.success('Prompt updated successfully');
    } catch (error) {
      console.error('Error updating prompt:', error);
      toast.error('Failed to update prompt');
    }
  };

  // Initialize edit form when a prompt is selected
  useEffect(() => {
    if (selectedPrompt) {
      setEditFormData({
        label: selectedPrompt.label,
        description: selectedPrompt.description,
        content: selectedPrompt.content,
        category: selectedPrompt.category,
      });
    }
  }, [selectedPrompt]);

  const filteredPrompts = getFilteredPrompts();

  return (
    <div className="space-y-6">
      {/* Category Filter and Add Button */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <select
            value={activeCategory || ''}
            onChange={(e) => setActiveCategory(e.target.value || null)}
            className={classNames(
              "w-full px-3 py-2 text-sm rounded-lg transition-colors duration-200",
              "bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333]",
              "text-gray-900 dark:text-white",
              "focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            )}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
        >
          <div className="i-ph:plus w-4 h-4" />
          Add Prompt
        </button>
      </div>

      {/* Prompts Table */}
      <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#0A0A0A]">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-[#333]">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-[#333]">
            {[...filteredPrompts.system, ...filteredPrompts.custom].map((prompt) => (
              <tr 
                key={prompt.id}
                className="bg-white dark:bg-[#0A0A0A] hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-colors duration-200"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={classNames(
                      'w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200',
                      'bg-gray-100 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333]',
                      promptStates[prompt.id] ? 'text-purple-500' : 'text-gray-500 dark:text-gray-400'
                    )}>
                      {prompt.id in systemPrompts ? (
                        <div className="i-ph:gear-fill w-4 h-4" />
                      ) : (
                        <div className="i-ph:book-open-text w-4 h-4" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{prompt.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{prompt.category}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{prompt.description}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {!(prompt.id in systemPrompts) && (
                      <button
                        onClick={() => {
                          setDeletePromptId(prompt.id);
                          setShowDeleteDialog(true);
                        }}
                        className={classNames(
                          "p-1.5 rounded-lg transition-all duration-200",
                          "text-gray-400 dark:text-red-500/50", // Dark modda silik kırmızı
                          "hover:text-red-500 dark:hover:text-red-500", // Hover'da tam kırmızı
                          "hover:bg-red-500/10 dark:hover:bg-red-950" // Dark modda daha koyu arka plan
                        )}
                        title="Delete Prompt"
                      >
                        <div className="i-ph:trash w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedPrompt(prompt as CustomPrompt);
                        setShowViewDialog(true);
                      }}
                      className={classNames(
                        "p-1.5 rounded-lg transition-all duration-200",
                        "text-gray-400 dark:text-purple-500/50", // Dark modda silik mor
                        "hover:text-purple-500 dark:hover:text-purple-400", // Hover'da parlak mor
                        "hover:bg-purple-500/10 dark:hover:bg-purple-950" // Dark modda daha koyu arka plan
                      )}
                      title="View Prompt"
                    >
                      <div className="i-ph:eye w-4 h-4" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <Switch
                      checked={promptStates[prompt.id] || false}
                      onCheckedChange={() => handleTogglePromptState(prompt.id)}
                      className={classNames(
                        "data-[state=checked]:bg-purple-500",
                        "dark:bg-[#333] dark:data-[state=checked]:bg-purple-500"
                      )}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      <div className={classNames(
        "flex flex-col items-center justify-center py-12 rounded-lg border border-dashed transition-colors duration-200",
        "bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-[#333]",
        filteredPrompts.system.length === 0 && filteredPrompts.custom.length === 0 ? "block" : "hidden"
      )}>
        <div className="i-ph:book-open w-12 h-12 text-gray-400 dark:text-gray-600 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No prompts found</h3>
        {activeCategory ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            No prompts in the "{activeCategory}" category
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Add a prompt to get started
          </p>
        )}
        <button
          onClick={() => setShowAddDialog(true)}
          className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-500 text-white text-sm hover:bg-purple-600 transition-colors duration-200"
        >
          <div className="i-ph:plus w-4 h-4" />
          Add Your First Prompt
        </button>
      </div>

      {/* Add Prompt Dialog */}
      <DialogRoot open={showAddDialog} onOpenChange={setShowAddDialog}>
        <Dialog className="max-w-2xl">
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:book-open-text w-6 h-6 text-purple-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">Add New Prompt</DialogTitle>
            </div>
            
            <DialogDescription className="mb-6 text-gray-500 dark:text-gray-400">
              Create a custom prompt that will be available in the prompt selection dropdown.
            </DialogDescription>
            
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prompt Name
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="E.g., Technical Writing Assistant"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="E.g., Specialized for technical documentation and explanations"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                
                {/* Category selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    >
                      <option value="Custom">Custom</option>
                      <option value="Development">Development</option>
                      <option value="Writing">Writing</option>
                      <option value="Business">Business</option>
                      <option value="Education">Education</option>
                      {/* New development-focused categories */}
                      <option value="Code Quality">Code Quality</option>
                      <option value="Project Continuation">Project Continuation</option>
                      <option value="Debugging">Debugging</option>
                      <option value="Refactoring">Refactoring</option>
                      <option value="Code Architecture">Code Architecture</option>
                      <option value="Testing">Testing</option>
                      <option value="Performance">Performance</option>
                      <option value="custom">Add new category...</option>
                    </select>
                  </div>
                  
                  {formData.category === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Category Name
                      </label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="E.g., Data Science"
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    </div>
                  )}
                </div>
                
                {/* Prompt Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Prompt Content
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Enter your prompt text here..."
                      rows={10}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[#333]">
              <DialogButton
                variant="secondary"
                onClick={() => setShowAddDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] rounded-md transition-colors duration-200"
              >
                Cancel
              </DialogButton>
              <DialogButton
                variant="primary"
                onClick={handleAddPrompt}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-md transition-colors duration-200"
              >
                Add Prompt
              </DialogButton>
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* View/Edit Prompt Dialog */}
      <DialogRoot open={showViewDialog} onOpenChange={setShowViewDialog}>
        <Dialog className="max-w-2xl">
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:book-open-text w-6 h-6 text-purple-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Prompt' : 'View Prompt'}
              </DialogTitle>
            </div>
            
            {selectedPrompt && (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.label}
                        onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-[#1A1A1A] p-3 rounded-lg border border-gray-200 dark:border-[#333]">
                        {selectedPrompt.label}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    {isEditing ? (
                      <select
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      >
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-[#1A1A1A] p-3 rounded-lg border border-gray-200 dark:border-[#333]">
                        {selectedPrompt.category}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-[#1A1A1A] p-3 rounded-lg border border-gray-200 dark:border-[#333]">
                        {selectedPrompt.description}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Content
                    </label>
                    {isEditing ? (
                      <textarea
                        value={editFormData.content}
                        onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })}
                        rows={10}
                        className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] rounded-md text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                      />
                    ) : (
                      <div className="bg-gray-50 dark:bg-[#1A1A1A] p-4 rounded-lg border border-gray-200 dark:border-[#333]">
                        <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap font-mono overflow-x-auto">
                          {selectedPrompt.content}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[#333]">
              {isEditing ? (
                <>
                  <DialogButton
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(false);
                      if (selectedPrompt) {
                        setEditFormData({
                          label: selectedPrompt.label,
                          description: selectedPrompt.description,
                          content: selectedPrompt.content,
                          category: selectedPrompt.category,
                        });
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] rounded-md transition-colors duration-200"
                  >
                    Cancel
                  </DialogButton>
                  <DialogButton
                    variant="primary"
                    onClick={handleEditPrompt}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-md transition-colors duration-200"
                  >
                    Save Changes
                  </DialogButton>
                </>
              ) : (
                <>
                  <DialogButton
                    variant="secondary"
                    onClick={() => {
                      setIsEditing(false);
                      setShowViewDialog(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] rounded-md transition-colors duration-200"
                  >
                    Close
                  </DialogButton>
                  {selectedPrompt && !(selectedPrompt.id in systemPrompts) && (
                    <DialogButton
                      variant="primary"
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 rounded-md transition-colors duration-200"
                    >
                      <div className="i-ph:pencil-simple w-4 h-4 mr-2" />
                      Edit Prompt
                    </DialogButton>
                  )}
                </>
              )}
            </div>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <Dialog>
          <div className="p-6 bg-white dark:bg-[#0A0A0A] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center gap-3 mb-6">
              <div className="i-ph:warning-circle w-6 h-6 text-red-500" />
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">Delete Prompt</DialogTitle>
            </div>
            
            <DialogDescription className="mb-6 text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this prompt? This action cannot be undone.
            </DialogDescription>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[#333]">
              <DialogButton
                variant="secondary"
                onClick={() => {
                  setDeletePromptId(null);
                  setShowDeleteDialog(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] rounded-md transition-colors duration-200"
              >
                Cancel
              </DialogButton>
              <DialogButton
                variant="danger"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors duration-200"
              >
                Delete
              </DialogButton>
            </div>
          </div>
        </Dialog>
      </DialogRoot>
    </div>
  );
}
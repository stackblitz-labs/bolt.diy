/**
 * Create Project Dialog
 *
 * Modal dialog for creating new website projects with name, description,
 * and optional Google Maps URL.
 */

import React, { useState } from 'react';
import { DialogRoot, Dialog, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Button } from '~/components/ui/Button';
import type { CreateProjectInput } from '~/types/project';

interface CreateProjectDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback when the dialog is closed
   */
  onClose: () => void;

  /**
   * Callback when a project is created
   */
  onCreateProject: (input: CreateProjectInput) => Promise<void>;

  /**
   * Whether the creation is in progress
   */
  isLoading?: boolean;

  /**
   * Error message to display
   */
  error?: string | null;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  onCreateProject,
  isLoading = false,
  error = null,
}: CreateProjectDialogProps) {
  const [formData, setFormData] = useState<CreateProjectInput>({
    name: '',
    description: '',
    gmaps_url: '',
  });

  const [touched, setTouched] = useState({
    name: false,
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        gmaps_url: '',
      });
      setTouched({ name: false });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({ name: true });

    // Validate required fields
    if (!formData.name.trim()) {
      return;
    }

    await onCreateProject(formData);
  };

  const handleInputChange =
    (field: keyof CreateProjectInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  const handleBlur = (field: keyof typeof touched) => () => {
    setTouched((prev) => ({
      ...prev,
      [field]: true,
    }));
  };

  const nameError = touched.name && !formData.name.trim() ? 'Project name is required' : null;

  const isValid = !nameError;

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog>
        <div className="p-6 w-[500px] max-w-[90vw]">
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Start a new website project. You can add restaurant information later if needed.
          </DialogDescription>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            {/* Project Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Project Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange('name')}
                onBlur={handleBlur('name')}
                placeholder="My Restaurant Website"
                className={nameError ? 'border-red-500' : ''}
                disabled={isLoading}
                maxLength={255}
                required
              />
              {nameError && <p className="mt-1 text-sm text-red-500">{nameError}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Description
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={handleInputChange('description')}
                placeholder="A modern website for our downtown restaurant featuring online reservations and menu displays."
                disabled={isLoading}
                maxLength={1000}
                rows={3}
              />
              <p className="mt-1 text-xs text-bolt-elements-textTertiary">
                Optional: Brief description of your project (1000 characters max)
              </p>
            </div>

            {/* Google Maps URL */}
            <div>
              <label htmlFor="gmaps_url" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                Google Maps URL (Optional)
              </label>
              <Input
                id="gmaps_url"
                type="url"
                value={formData.gmaps_url}
                onChange={handleInputChange('gmaps_url')}
                placeholder="https://maps.google.com/?q=restaurant+name"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-bolt-elements-textTertiary">
                Optional: Link to your restaurant on Google Maps for automatic business info
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="border-bolt-elements-borderColor text-bolt-elements-textPrimary"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!isValid || isLoading}
                className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="i-ph-spinner-gap-bold animate-spin w-4 h-4 mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <div className="i-ph-plus-bold w-4 h-4 mr-2" />
                    Create Project
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </DialogRoot>
  );
}

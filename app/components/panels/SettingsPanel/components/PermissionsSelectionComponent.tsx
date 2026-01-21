import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { permissionsStore, setPermissions as setPermissionsStore } from '~/lib/stores/permissions';
import { setAppPermissions, AppAccessKind, AppAccessorKind, type AppPermission } from '~/lib/api/permissions';
import { IconButton } from '~/components/ui/IconButton';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';
import {
  User,
  Users,
  Globe,
  Info,
  Copy,
  Eye,
  Send,
  Pencil,
  KeyRound,
  ChevronDown,
  ToggleRight,
  ToggleLeft,
  Trash2,
  ChevronUp,
  Lock,
  X,
  AlertCircle,
  PlusCircle,
} from '~/components/ui/Icon';
import { Button } from '~/components/ui/button';

interface PermissionGroup {
  accessor: AppAccessorKind;
  accessorName?: string;
  permissions: Array<AppPermission & { index: number }>;
}

export const PermissionsSelectionComponent: React.FC = () => {
  const appId = useStore(chatStore.currentAppId);
  const permissions = useStore(permissionsStore);
  const [saving, setSaving] = useState(false);
  const [showAddPermission, setShowAddPermission] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [newPermission, setNewPermission] = useState<AppPermission>({
    access: AppAccessKind.View,
    accessor: AppAccessorKind.User,
    accessorName: '',
    allowed: true,
  });
  const [validationState, setValidationState] = useState<{ isValid: boolean; errorMessage?: string }>({
    isValid: false,
  });

  // Validation helpers
  const validateEmail = (email: string): boolean => {
    if (!email) {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateDomain = (domain: string): boolean => {
    if (!domain) {
      return false;
    }
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
  };

  const getInputValidationState = (): { isValid: boolean; errorMessage?: string } => {
    const { accessor, accessorName } = newPermission;

    // Everyone doesn't need validation
    if (accessor === AppAccessorKind.Everyone) {
      return { isValid: true };
    }

    // Empty is technically invalid but we don't show error for empty state
    if (!accessorName || !accessorName.trim()) {
      return { isValid: false };
    }

    if (accessor === AppAccessorKind.User) {
      const isValid = validateEmail(accessorName);
      return {
        isValid,
        errorMessage: isValid ? undefined : 'Please enter a valid email address (e.g., user@example.com)',
      };
    }

    if (accessor === AppAccessorKind.Domain) {
      const isValid = validateDomain(accessorName);
      return {
        isValid,
        errorMessage: isValid ? undefined : 'Please enter a valid domain (e.g., example.com)',
      };
    }

    return { isValid: true };
  };

  // Update validation state whenever newPermission changes
  useEffect(() => {
    const computedValidationState = getInputValidationState();
    setValidationState(computedValidationState);
  }, [newPermission.accessor, newPermission.accessorName]);

  // Group permissions by accessor
  const groupPermissions = (): PermissionGroup[] => {
    const groups = new Map<string, PermissionGroup>();

    permissions.forEach((permission, index) => {
      const key = `${permission.accessor}-${permission.accessorName || 'everyone'}`;

      if (!groups.has(key)) {
        groups.set(key, {
          accessor: permission.accessor,
          accessorName: permission.accessorName,
          permissions: [],
        });
      }

      groups.get(key)!.permissions.push({ ...permission, index });
    });

    return Array.from(groups.values());
  };

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const getGroupKey = (group: PermissionGroup): string => {
    return `${group.accessor}-${group.accessorName || 'everyone'}`;
  };

  const getGroupLabel = (group: PermissionGroup): string => {
    switch (group.accessor) {
      case AppAccessorKind.User:
        return group.accessorName || 'Unknown User';
      case AppAccessorKind.Domain:
        return `@${group.accessorName}`;
      case AppAccessorKind.Everyone:
        return 'Everyone';
      default:
        return group.accessor;
    }
  };

  const getGroupIcon = (group: PermissionGroup): JSX.Element => {
    switch (group.accessor) {
      case AppAccessorKind.User:
        return <User className="text-bolt-elements-textSecondary" size={16} />;
      case AppAccessorKind.Domain:
        return <Users className="text-bolt-elements-textSecondary" size={16} />;
      case AppAccessorKind.Everyone:
        return <Globe className="text-bolt-elements-textSecondary" size={16} />;
      default:
        return <Info className="text-bolt-elements-textSecondary" size={16} />;
    }
  };

  const handleAddPermission = async () => {
    if (!appId) {
      return;
    }

    if (!validationState.isValid) {
      if (validationState.errorMessage) {
        toast.error(validationState.errorMessage);
      } else if (newPermission.accessor !== AppAccessorKind.Everyone) {
        toast.error('Please enter an email or domain');
      }
      return;
    }

    // If "All Permissions" is selected, create permissions for all access kinds
    const permissionsToAdd: AppPermission[] = [];

    if (newPermission.access === AppAccessKind.AllPermissions) {
      // Get all access kinds except AllPermissions itself
      const allAccessKinds = Object.values(AppAccessKind).filter((kind) => kind !== AppAccessKind.AllPermissions);

      // Create a permission for each access kind using the same accessor settings
      for (const accessKind of allAccessKinds) {
        const permission: AppPermission = {
          access: accessKind,
          accessor: newPermission.accessor,
          accessorName: newPermission.accessorName,
          allowed: newPermission.allowed,
        };

        // Check if this specific permission already exists
        const isDuplicate = permissions.some(
          (p) =>
            p.access === permission.access &&
            p.accessor === permission.accessor &&
            p.accessorName === permission.accessorName,
        );

        // Only add if not a duplicate
        if (!isDuplicate) {
          permissionsToAdd.push(permission);
        }
      }

      if (permissionsToAdd.length === 0) {
        toast.error('All permissions already exist for this accessor');
        return;
      }
    } else {
      // Single permission - check for duplicates
      const isDuplicate = permissions.some(
        (p) =>
          p.access === newPermission.access &&
          p.accessor === newPermission.accessor &&
          p.accessorName === newPermission.accessorName,
      );

      if (isDuplicate) {
        toast.error('This permission already exists');
        return;
      }

      permissionsToAdd.push(newPermission);

      const requiresView = [AppAccessKind.SendMessage, AppAccessKind.SetTitle, AppAccessKind.SetPermissions].includes(
        newPermission.access,
      );

      if (requiresView) {
        const viewPermissionExists = [...permissions, ...permissionsToAdd].some(
          (p) =>
            p.access === AppAccessKind.View &&
            p.accessor === newPermission.accessor &&
            p.accessorName === newPermission.accessorName,
        );

        if (!viewPermissionExists) {
          permissionsToAdd.push({
            access: AppAccessKind.View,
            accessor: newPermission.accessor,
            accessorName: newPermission.accessorName,
            allowed: newPermission.allowed,
          });
        }
      }
    }

    // Add the new permission(s) and save to backend
    const updatedPermissions = [...permissions, ...permissionsToAdd];

    try {
      setSaving(true);
      const { error } = await setAppPermissions(appId, updatedPermissions);

      if (error) {
        toast.error(error);
        return;
      }

      // Update store after successful save
      setPermissionsStore(updatedPermissions);

      // Success message based on how many permissions were added
      const message =
        permissionsToAdd.length === 1
          ? 'Permission added successfully'
          : `${permissionsToAdd.length} permissions added successfully`;
      toast.success(message);

      // Reset the form and close the add section
      setShowAddPermission(false);
      setNewPermission({
        access: AppAccessKind.View,
        accessor: AppAccessorKind.User,
        accessorName: '',
        allowed: true,
      });
    } catch (error) {
      console.error('Failed to add permission:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add permission');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePermission = async (index: number) => {
    if (!appId) {
      return;
    }

    const updatedPermissions = permissions.filter((_, i) => i !== index);

    try {
      setSaving(true);
      const { error } = await setAppPermissions(appId, updatedPermissions);

      if (error) {
        toast.error(error);
        return;
      }

      // Update store after successful save
      setPermissionsStore(updatedPermissions);
      toast.success('Permission removed successfully');
    } catch (error) {
      console.error('Failed to remove permission:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove permission');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (index: number) => {
    if (!appId) {
      return;
    }

    const updatedPermissions = [...permissions];
    updatedPermissions[index] = {
      ...updatedPermissions[index],
      allowed: !updatedPermissions[index].allowed,
    };

    try {
      setSaving(true);
      const { error } = await setAppPermissions(appId, updatedPermissions);

      if (error) {
        toast.error(error);
        return;
      }

      // Update store after successful save
      setPermissionsStore(updatedPermissions);
      toast.success('Permission updated successfully');
    } catch (error) {
      console.error('Failed to update permission:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  const getAccessLabel = (access: AppAccessKind): string => {
    const labels: Record<AppAccessKind, string> = {
      [AppAccessKind.AllPermissions]: 'All Permissions',
      [AppAccessKind.Copy]: 'Copy App',
      [AppAccessKind.View]: 'View App',
      [AppAccessKind.SendMessage]: 'Send Messages',
      [AppAccessKind.SetTitle]: 'Rename App',
      [AppAccessKind.Delete]: 'Delete App',
      [AppAccessKind.SetPermissions]: 'Manage Permissions',
    };
    return labels[access] || access;
  };

  const getAccessIcon = (access: AppAccessKind): JSX.Element => {
    const icons: Record<AppAccessKind, JSX.Element> = {
      [AppAccessKind.AllPermissions]: <KeyRound className="text-bolt-elements-textSecondary" size={14} />,
      [AppAccessKind.Copy]: <Copy className="text-bolt-elements-textSecondary" size={14} />,
      [AppAccessKind.View]: <Eye className="text-bolt-elements-textSecondary" size={14} />,
      [AppAccessKind.SendMessage]: <Send className="text-bolt-elements-textSecondary" size={14} />,
      [AppAccessKind.SetTitle]: <Pencil className="text-bolt-elements-textSecondary" size={14} />,
      [AppAccessKind.Delete]: <Trash2 className="text-bolt-elements-textSecondary" size={14} />,
      [AppAccessKind.SetPermissions]: <KeyRound className="text-bolt-elements-textSecondary" size={14} />,
    };
    return icons[access] || <Info className="text-bolt-elements-textSecondary" size={14} />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-bolt-elements-textPrimary">App Permissions</h3>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">Control who can access and modify your app</p>
        </div>
      </div>

      {/* Share URL Info */}
      {appId && (
        <div className="p-4 border border-bolt-elements-borderColor rounded-md">
          <div className="flex items-start gap-3">
            <Info className="text-bolt-elements-textSecondary flex-shrink-0 mt-0.5" size={16} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-bolt-elements-textPrimary font-medium mb-1">Share this app</p>
              <p className="text-sm text-bolt-elements-textSecondary mb-3">
                After setting permissions, share this URL with the people you want to give access to:
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-9 px-3 flex items-center bg-background rounded-md border border-bolt-elements-borderColor text-sm text-bolt-elements-textPrimary truncate">
                  nut.new/app/{appId}
                </div>
                <TooltipProvider>
                  <WithTooltip tooltip="Copy URL">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://nut.new/app/${appId}`);
                        toast.success('URL copied to clipboard!');
                      }}
                      className="h-9 w-9 flex items-center justify-center rounded-md border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2 transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                  </WithTooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing Permissions - Grouped */}
      {permissions.length > 0 ? (
        <>
          <div className="space-y-2">
            {(() => {
              const allGroups = groupPermissions();
              const displayedGroups = showAllGroups ? allGroups : allGroups.slice(0, 3);

              return displayedGroups.map((group) => {
                const groupKey = getGroupKey(group);
                const isExpanded = expandedGroups.has(groupKey);

                return (
                  <div key={groupKey} className="rounded-md border border-bolt-elements-borderColor overflow-hidden">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-bolt-elements-background-depth-2 transition-colors"
                    >
                      {/* Icon */}
                      {getGroupIcon(group)}

                      {/* Label */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                          {getGroupLabel(group)}
                        </div>
                        <div className="text-xs text-bolt-elements-textSecondary">
                          {group.permissions.length} permission{group.permissions.length !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Expand Icon */}
                      <div
                        className={`text-bolt-elements-textSecondary transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      >
                        <ChevronDown size={16} />
                      </div>
                    </button>

                    {/* Group Content */}
                    {isExpanded && (
                      <div className="border-t border-bolt-elements-borderColor">
                        <div className="p-2 space-y-1">
                          {group.permissions.map((permission) => (
                            <div
                              key={permission.index}
                              className="px-3 py-2 rounded-md border border-bolt-elements-borderColor"
                            >
                              <div className="flex items-center gap-2">
                                {/* Access Icon */}
                                {getAccessIcon(permission.access)}

                                {/* Permission Label */}
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-bolt-elements-textPrimary">
                                    {getAccessLabel(permission.access)}
                                  </span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  <span className="text-sm px-2 py-1 rounded-md border border-bolt-elements-borderColor text-bolt-elements-textSecondary">
                                    {permission.allowed ? 'Allowed' : 'Denied'}
                                  </span>
                                  <TooltipProvider>
                                    <WithTooltip tooltip={permission.allowed ? 'Deny access' : 'Allow access'}>
                                      <Button
                                        onClick={() => handleTogglePermission(permission.index)}
                                        disabled={saving}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                      >
                                        {permission.allowed ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                      </Button>
                                    </WithTooltip>
                                    <WithTooltip tooltip="Remove permission">
                                      <Button
                                        onClick={() => handleRemovePermission(permission.index)}
                                        disabled={saving}
                                        variant="outline"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 size={14} />
                                      </Button>
                                    </WithTooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          {/* Show More/Less Button */}
          {(() => {
            const allGroups = groupPermissions();
            const hiddenCount = allGroups.length - 3;

            if (allGroups.length > 3) {
              return (
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowAllGroups(!showAllGroups)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                  >
                    <span>
                      {showAllGroups
                        ? `Hide ${hiddenCount} accessor${hiddenCount !== 1 ? 's' : ''}`
                        : `Show ${hiddenCount} more accessor${hiddenCount !== 1 ? 's' : ''}`}
                    </span>
                    {showAllGroups ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              );
            }
            return null;
          })()}
        </>
      ) : (
        <div className="text-center py-8">
          <Lock className="mx-auto text-bolt-elements-textSecondary opacity-50 mb-3" size={32} />
          <p className="text-sm text-bolt-elements-textSecondary">No permissions set</p>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">Add permissions to control access to your app</p>
        </div>
      )}

      {/* Add Permission Section */}
      {showAddPermission ? (
        <div className="p-4 rounded-md border border-bolt-elements-borderColor space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">Add Permission</h4>
            <IconButton
              onClick={() => setShowAddPermission(false)}
              className="h-7 w-7 p-0 rounded-md hover:bg-bolt-elements-background-depth-2 transition-colors"
              icon={<X size={16} />}
              size="sm"
            />
          </div>

          {/* Access Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-bolt-elements-textPrimary">Access Type</label>
            <select
              value={newPermission.access}
              onChange={(e) => setNewPermission({ ...newPermission, access: e.target.value as AppAccessKind })}
              className="w-full h-10 px-3 text-sm rounded-md border border-bolt-elements-borderColor bg-background text-bolt-elements-textPrimary focus:border-bolt-elements-focus focus:outline-none transition-colors"
            >
              {Object.values(AppAccessKind).map((access) => (
                <option key={access} value={access}>
                  {getAccessLabel(access)}
                </option>
              ))}
            </select>
          </div>

          {/* Accessor Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-bolt-elements-textPrimary">Who Can Access</label>
            <select
              value={newPermission.accessor}
              onChange={(e) =>
                setNewPermission({
                  ...newPermission,
                  accessor: e.target.value as AppAccessorKind,
                  accessorName: e.target.value === AppAccessorKind.Everyone ? undefined : '',
                })
              }
              className="w-full h-10 px-3 text-sm rounded-md border border-bolt-elements-borderColor bg-background text-bolt-elements-textPrimary focus:border-bolt-elements-focus focus:outline-none transition-colors"
            >
              <option value={AppAccessorKind.User}>Specific User (Email)</option>
              <option value={AppAccessorKind.Domain}>Anyone with Domain</option>
              <option value={AppAccessorKind.Everyone}>Everyone</option>
            </select>
          </div>

          {/* Email/Domain Input */}
          {newPermission.accessor !== AppAccessorKind.Everyone &&
            (() => {
              const showError =
                newPermission.accessorName && newPermission.accessorName.trim() && !validationState.isValid;

              return (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-bolt-elements-textPrimary">
                    {newPermission.accessor === AppAccessorKind.User ? 'Email Address' : 'Domain'}
                  </label>
                  <input
                    type="text"
                    value={newPermission.accessorName || ''}
                    onChange={(e) => setNewPermission({ ...newPermission, accessorName: e.target.value })}
                    placeholder={newPermission.accessor === AppAccessorKind.User ? 'user@example.com' : 'example.com'}
                    className={`w-full h-10 px-3 text-sm rounded-md border bg-background text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary focus:outline-none transition-colors ${
                      showError
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-bolt-elements-borderColor focus:border-bolt-elements-focus'
                    }`}
                  />
                  {showError && validationState.errorMessage && (
                    <div className="flex items-center gap-1.5 text-sm text-red-500">
                      <AlertCircle size={14} />
                      <span>{validationState.errorMessage}</span>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Allow/Deny */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-bolt-elements-textPrimary">Permission</label>
            <div className="flex gap-2">
              <button
                onClick={() => setNewPermission({ ...newPermission, allowed: true })}
                className={`flex-1 h-10 text-sm rounded-md border transition-colors ${
                  newPermission.allowed
                    ? 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary font-medium'
                    : 'border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                Allow
              </button>
              <button
                onClick={() => setNewPermission({ ...newPermission, allowed: false })}
                className={`flex-1 h-10 text-sm rounded-md border transition-colors ${
                  !newPermission.allowed
                    ? 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary font-medium'
                    : 'border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-2'
                }`}
              >
                Deny
              </button>
            </div>
          </div>

          {/* Add Button */}
          <Button onClick={handleAddPermission} disabled={saving || !validationState.isValid} className="w-full gap-2">
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <PlusCircle size={16} />
                <span>Add Permission</span>
              </>
            )}
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAddPermission(true)} className="w-full gap-2">
          <PlusCircle size={16} />
          <span>Add Permission</span>
        </Button>
      )}
    </div>
  );
};

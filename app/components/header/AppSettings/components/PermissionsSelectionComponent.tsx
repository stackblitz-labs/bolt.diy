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
  LockOpen,
  X,
  AlertCircle,
  PlusCircle,
} from '~/components/ui/Icon';

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
        return <User className="text-blue-500" size={18} />;
      case AppAccessorKind.Domain:
        return <Users className="text-blue-500" size={18} />;
      case AppAccessorKind.Everyone:
        return <Globe className="text-blue-500" size={18} />;
      default:
        return <Info className="text-blue-500" size={18} />;
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
      //   [AppAccessKind.Delete]: 'Delete App',
      [AppAccessKind.SetPermissions]: 'Manage Permissions',
    };
    return labels[access] || access;
  };

  const getAccessIcon = (access: AppAccessKind, allowed: boolean): JSX.Element => {
    const icons: Record<AppAccessKind, JSX.Element> = {
      [AppAccessKind.AllPermissions]: (
        <KeyRound className={`text-xs ${allowed ? 'text-blue-500' : 'text-red-500'}`} size={16} />
      ),
      [AppAccessKind.Copy]: <Copy className={`text-xs ${allowed ? 'text-blue-500' : 'text-red-500'}`} size={16} />,
      [AppAccessKind.View]: <Eye className={`text-xs ${allowed ? 'text-blue-500' : 'text-red-500'}`} size={16} />,
      [AppAccessKind.SendMessage]: (
        <Send className={`text-xs ${allowed ? 'text-blue-500' : 'text-red-500'}`} size={16} />
      ),
      [AppAccessKind.SetTitle]: (
        <Pencil className={`text-xs ${allowed ? 'text-blue-500' : 'text-red-500'}`} size={16} />
      ),
      // [AppAccessKind.Delete]: <Trash className="text-blue-500" size={16} />,
      [AppAccessKind.SetPermissions]: (
        <KeyRound className={`text-xs ${allowed ? 'text-blue-500' : 'text-red-500'}`} size={16} />
      ),
    };
    return (
      icons[access] || (
        <Info className={`text-xs ${allowed ? 'text-bolt-elements-textPrimary' : 'text-red-500'}`} size={16} />
      )
    );
  };

  return (
    <div className="p-5 bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm bg-gradient-to-br from-purple-500 to-purple-600">
          <KeyRound className="text-white" size={18} />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-bolt-elements-textHeading">App Permissions</h3>
          <p className="text-xs text-bolt-elements-textSecondary">Control who can access and modify your app</p>
        </div>
      </div>

      {/* Share URL Info */}
      {appId && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Info className="text-blue-500" size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-bolt-elements-textPrimary font-medium mb-2">Share this app</p>
              <p className="text-xs text-bolt-elements-textSecondary mb-3">
                After setting permissions, share this URL with the people you want to give access to:
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor font-medium text-s text-bolt-elements-textPrimary truncate">
                  nut.new/app/{appId}
                </div>
                <TooltipProvider>
                  <WithTooltip tooltip="Copy URL">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://nut.new/app/${appId}`);
                        toast.success('URL copied to clipboard!');
                      }}
                      className="p-2 rounded-lg bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 flex-shrink-0"
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
          <div className="space-y-2 mb-4">
            {(() => {
              const allGroups = groupPermissions();
              const displayedGroups = showAllGroups ? allGroups : allGroups.slice(0, 3);

              return displayedGroups.map((group) => {
                const groupKey = getGroupKey(group);
                const isExpanded = expandedGroups.has(groupKey);

                return (
                  <div
                    key={groupKey}
                    className="rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 overflow-hidden"
                  >
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(groupKey)}
                      className="w-full p-3 flex items-center gap-3 bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-2 transition-all"
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-md bg-bolt-elements-background-depth-3 flex items-center justify-center">
                        {getGroupIcon(group)}
                      </div>

                      {/* Label */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-bolt-elements-textHeading truncate">
                          {getGroupLabel(group)}
                        </div>
                        <div className="text-xs text-bolt-elements-textSecondary">
                          {group.permissions.length} permission{group.permissions.length !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Expand Icon */}
                      <div
                        className={`flex-shrink-0 text-bolt-elements-textSecondary transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      >
                        <ChevronDown size={18} />
                      </div>
                    </button>

                    {/* Group Content */}
                    {isExpanded && (
                      <div className="border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
                        <div className="p-2 space-y-1">
                          {group.permissions.map((permission) => (
                            <div
                              key={permission.index}
                              className={`p-2 rounded-lg border transition-all duration-200 ${
                                permission.allowed
                                  ? 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor'
                                  : 'bg-red-500/10 border-red-500/30'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {/* Access Icon */}
                                <div
                                  className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${
                                    permission.allowed ? 'bg-bolt-elements-background-depth-3' : 'bg-red-500/20'
                                  }`}
                                >
                                  {getAccessIcon(permission.access, permission.allowed)}
                                </div>

                                {/* Permission Label */}
                                <div className="flex-1 min-w-0">
                                  <span
                                    className={`text-sm font-medium text-xs ${permission.allowed ? 'text-bolt-elements-textPrimary' : 'text-red-500'}`}
                                  >
                                    {getAccessLabel(permission.access)}
                                  </span>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      permission.allowed
                                        ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                                        : 'bg-red-500/20 text-red-600 border border-red-500/30'
                                    }`}
                                  >
                                    {permission.allowed ? 'Allowed' : 'Denied'}
                                  </span>
                                  <TooltipProvider>
                                    <WithTooltip tooltip={permission.allowed ? 'Deny access' : 'Allow access'}>
                                      <button
                                        onClick={() => handleTogglePermission(permission.index)}
                                        disabled={saving}
                                        className="p-1.5 rounded-lg bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {permission.allowed ? (
                                          <ToggleRight className="text-green-500" size={14} />
                                        ) : (
                                          <ToggleLeft className="text-red-500" size={14} />
                                        )}
                                      </button>
                                    </WithTooltip>
                                    <WithTooltip tooltip="Remove permission">
                                      <button
                                        onClick={() => handleRemovePermission(permission.index)}
                                        disabled={saving}
                                        className="p-1.5 rounded-lg bg-bolt-elements-background-depth-2 text-red-500 hover:bg-bolt-elements-background-depth-3 hover:text-red-600 border border-bolt-elements-borderColor transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 size={14} />
                                      </button>
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
                <div className="flex justify-center mb-4">
                  <button
                    onClick={() => setShowAllGroups(!showAllGroups)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor border-opacity-50 rounded-lg transition-all duration-200 hover:shadow-sm"
                  >
                    <span>
                      {showAllGroups
                        ? `Hide ${hiddenCount} accessor${hiddenCount !== 1 ? 's' : ''}`
                        : `Show ${hiddenCount} more accessor${hiddenCount !== 1 ? 's' : ''}`}
                    </span>
                    {showAllGroups ? (
                      <ChevronUp className="text-sm transition-transform duration-200" size={14} strokeWidth={2.5} />
                    ) : (
                      <ChevronDown className="text-sm transition-transform duration-200" size={14} strokeWidth={2.5} />
                    )}
                  </button>
                </div>
              );
            }
            return null;
          })()}
        </>
      ) : (
        <div className="text-center py-6 mb-4">
          <LockOpen className="text-bolt-elements-textSecondary mb-2 opacity-50" size={36} />
          <p className="text-sm text-bolt-elements-textSecondary">No permissions set</p>
          <p className="text-xs text-bolt-elements-textTertiary">Add permissions to control access to your app</p>
        </div>
      )}

      {/* Add Permission Section */}
      {showAddPermission ? (
        <div className="p-4 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-bolt-elements-textHeading">Add Permission</h4>
            <IconButton
              onClick={() => setShowAddPermission(false)}
              className="p-1 rounded hover:bg-bolt-elements-background-depth-2 transition-colors"
              icon={<X size={16} />}
              size="sm"
            />
          </div>

          {/* Access Type */}
          <div>
            <label className="block text-xs font-medium text-bolt-elements-textPrimary mb-1.5">Access Type</label>
            <select
              value={newPermission.access}
              onChange={(e) => setNewPermission({ ...newPermission, access: e.target.value as AppAccessKind })}
              className="w-full p-3 text-sm rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              {Object.values(AppAccessKind).map((access) => (
                <option key={access} value={access}>
                  {getAccessLabel(access)}
                </option>
              ))}
            </select>
          </div>

          {/* Accessor Type */}
          <div>
            <label className="block text-xs font-medium text-bolt-elements-textPrimary mb-1.5">Who Can Access</label>
            <select
              value={newPermission.accessor}
              onChange={(e) =>
                setNewPermission({
                  ...newPermission,
                  accessor: e.target.value as AppAccessorKind,
                  accessorName: e.target.value === AppAccessorKind.Everyone ? undefined : '',
                })
              }
              className="w-full p-3 text-sm rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
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
                <div>
                  <label className="block text-xs font-medium text-bolt-elements-textPrimary mb-1.5">
                    {newPermission.accessor === AppAccessorKind.User ? 'Email Address' : 'Domain'}
                  </label>
                  <input
                    type="text"
                    value={newPermission.accessorName || ''}
                    onChange={(e) => setNewPermission({ ...newPermission, accessorName: e.target.value })}
                    placeholder={newPermission.accessor === AppAccessorKind.User ? 'user@example.com' : 'example.com'}
                    className={`w-full p-3 text-sm rounded-lg border transition-all ${
                      showError
                        ? 'border-red-500/50 bg-red-500/5 text-bolt-elements-textPrimary hover:bg-red-500/10 placeholder-bolt-elements-textSecondary focus:ring-2 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 placeholder-bolt-elements-textSecondary focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                    }`}
                  />
                  {showError && validationState.errorMessage && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={14} />
                      <p className="text-xs text-red-500">{validationState.errorMessage}</p>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Allow/Deny */}
          <div>
            <label className="block text-xs font-medium text-bolt-elements-textPrimary mb-1.5">Permission</label>
            <div className="flex gap-2">
              <button
                onClick={() => setNewPermission({ ...newPermission, allowed: true })}
                className={`flex-1 p-2 text-sm rounded-lg border transition-all ${
                  newPermission.allowed
                    ? 'bg-green-500/20 border-green-500/50 text-green-600 font-medium'
                    : 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3'
                }`}
              >
                Allow
              </button>
              <button
                onClick={() => setNewPermission({ ...newPermission, allowed: false })}
                className={`flex-1 p-2 text-sm rounded-lg border transition-all ${
                  !newPermission.allowed
                    ? 'bg-red-500/20 border-red-500/50 text-red-600 font-medium'
                    : 'bg-bolt-elements-background-depth-2 border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3'
                }`}
              >
                Deny
              </button>
            </div>
          </div>

          {/* Add Button */}
          <button
            onClick={handleAddPermission}
            disabled={saving || !validationState.isValid}
            className="w-full mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <PlusCircle size={18} />
                <span>Add Permission</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddPermission(true)}
          className="w-full px-4 py-2.5 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary transition-all flex items-center justify-center gap-2 text-sm font-medium hover:scale-105"
        >
          <PlusCircle size={18} />
          <span>Add Permission</span>
        </button>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { permissionsStore, setPermissions as setPermissionsStore } from '~/lib/stores/permissions';
import { setAppPermissions, AppAccessKind, AppAccessorKind, type AppPermission } from '~/lib/api/permissions';
import { IconButton } from '~/components/ui/IconButton';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import WithTooltip from '~/components/ui/Tooltip';

export const PermissionsSelectionComponent: React.FC = () => {
  const appId = useStore(chatStore.currentAppId);
  const permissions = useStore(permissionsStore);
  const [saving, setSaving] = useState(false);
  const [showAddPermission, setShowAddPermission] = useState(false);
  const [newPermission, setNewPermission] = useState<AppPermission>({
    access: AppAccessKind.View,
    accessor: AppAccessorKind.User,
    accessorName: '',
    allowed: true,
  });

  const handleAddPermission = async () => {
    if (!appId) {
      return;
    }

    // Validate the new permission
    if (
      (newPermission.accessor === AppAccessorKind.User || newPermission.accessor === AppAccessorKind.Domain) &&
      !newPermission.accessorName?.trim()
    ) {
      toast.error('Please enter an email or domain');
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
    console.log('updatedPermissions', updatedPermissions);

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

  const getAccessorLabel = (permission: AppPermission): string => {
    switch (permission.accessor) {
      case AppAccessorKind.User:
        return `User: ${permission.accessorName}`;
      case AppAccessorKind.Domain:
        return `Domain: @${permission.accessorName}`;
      case AppAccessorKind.Everyone:
        return 'Everyone';
      default:
        return permission.accessor;
    }
  };

  const getAccessIcon = (access: AppAccessKind): string => {
    const icons: Record<AppAccessKind, string> = {
      [AppAccessKind.AllPermissions]: 'i-ph:unlock-key-duotone',
      [AppAccessKind.Copy]: 'i-ph:copy-duotone',
      [AppAccessKind.View]: 'i-ph:eye-duotone',
      [AppAccessKind.SendMessage]: 'i-ph:paper-plane-tilt-duotone',
      [AppAccessKind.SetTitle]: 'i-ph:pencil-duotone',
      // [AppAccessKind.Delete]: 'i-ph:trash-duotone',
      [AppAccessKind.SetPermissions]: 'i-ph:lock-key-duotone',
    };
    return icons[access] || 'i-ph:info';
  };

  return (
    <div className="p-5 bg-bolt-elements-background-depth-2 rounded-2xl border border-bolt-elements-borderColor">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm bg-gradient-to-br from-purple-500 to-purple-600">
          <div className="i-ph:lock-key text-lg text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-bolt-elements-textHeading">App Permissions</h3>
          <p className="text-xs text-bolt-elements-textSecondary">Control who can access and modify your app</p>
        </div>
      </div>

      {/* Existing Permissions */}
      {permissions.length > 0 ? (
        <div className="space-y-2 mb-4">
          {permissions.map((permission, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                permission.allowed
                  ? 'bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Access Icon */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
                    permission.allowed ? 'bg-bolt-elements-background-depth-3' : 'bg-red-500/20'
                  }`}
                >
                  <div
                    className={`${getAccessIcon(permission.access)} text-sm ${permission.allowed ? 'text-bolt-elements-textPrimary' : 'text-red-500'}`}
                  />
                </div>

                {/* Permission Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-bolt-elements-textPrimary">
                      {getAccessLabel(permission.access)}
                    </span>
                  </div>
                  <div className="text-xs text-bolt-elements-textSecondary mt-0.5">{getAccessorLabel(permission)}</div>
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
                        onClick={() => handleTogglePermission(index)}
                        disabled={saving}
                        className="p-2 rounded-xl bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div
                          className={`text-md ${permission.allowed ? 'i-ph:toggle-right text-green-500' : 'i-ph:toggle-left text-red-500'}`}
                        />
                      </button>
                    </WithTooltip>
                    <WithTooltip tooltip="Remove permission">
                      <button
                        onClick={() => handleRemovePermission(index)}
                        disabled={saving}
                        className="p-2 rounded-xl bg-bolt-elements-background-depth-2 text-red-500 hover:bg-bolt-elements-background-depth-3 hover:text-red-600 border border-bolt-elements-borderColor transition-all duration-200 shadow-sm hover:shadow-md hover:scale-105 group flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="i-ph:trash text-md" />
                      </button>
                    </WithTooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 mb-4">
          <div className="i-ph:lock-open text-4xl text-bolt-elements-textSecondary mb-2 opacity-50" />
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
              icon="i-ph:x"
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
          {newPermission.accessor !== AppAccessorKind.Everyone && (
            <div>
              <label className="block text-xs font-medium text-bolt-elements-textPrimary mb-1.5">
                {newPermission.accessor === AppAccessorKind.User ? 'Email Address' : 'Domain'}
              </label>
              <input
                type="text"
                value={newPermission.accessorName || ''}
                onChange={(e) => setNewPermission({ ...newPermission, accessorName: e.target.value })}
                placeholder={newPermission.accessor === AppAccessorKind.User ? 'user@example.com' : 'example.com'}
                className="w-full p-3 text-sm rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 placeholder-bolt-elements-textSecondary focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          )}

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
            disabled={saving}
            className="w-full mt-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <div className="i-ph:plus-circle text-lg" />
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
          <div className="i-ph:plus-circle text-lg" />
          <span>Add Permission</span>
        </button>
      )}
    </div>
  );
};

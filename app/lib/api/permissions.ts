import { callNutAPI } from '~/lib/replay/NutAPI';

/**
 * Kinds of ways that apps can be accessed.
 */
export enum AppAccessKind {
  /** Create a copy of an app with a new database. */
  Copy = 'CopyApp',

  /** View the app preview and chat history. */
  View = 'ViewApp',

  /** Send new messages to update the app. */
  SendMessage = 'SendMessage',

  /** Change the app's title. */
  SetTitle = 'RenameApp',

  /** Delete the app. */
  //   Delete = 'DeleteApp',

  /** Set new permissions for the app. */
  SetPermissions = 'SetPermissions',

  AllPermissions = 'AllPermissions',
}

/**
 * Kinds of accessors that can be granted permission for an access.
 */
export enum AppAccessorKind {
  /** Specific user email. */
  User = 'User',

  /** Anyone with their email in a given domain. */
  Domain = 'Domain',

  /** Everyone with knowledge of the app ID. */
  Everyone = 'Everyone',
}

/**
 * A permission that can be granted or denied to access an app.
 */
export interface AppPermission {
  /** Kind of access. */
  access: AppAccessKind;

  /** Kind of accessor. */
  accessor: AppAccessorKind;

  /** For User accessor: the email. For Domain accessor: the domain. Omitted for Everyone accessor. */
  accessorName?: string;

  /** Whether access is allowed or denied. */
  allowed: boolean;
}

/**
 * The permissions for an app are all the rules defined for who can access it.
 */
export type AppPermissions = AppPermission[];

/**
 * Request payload for getting app permissions.
 */
export interface GetAppPermissionsRequest {
  appId: string;
}

/**
 * Response payload for getting app permissions.
 */
export interface GetAppPermissionsResponse {
  permissions?: AppPermissions;
}

/**
 * Request payload for getting whether the current user is the owner of an app.
 */
export interface IsAppOwnerRequest {
  appId: string;
}

/**
 * Response payload for getting whether the current user is the owner of an app.
 */
export interface IsAppOwnerResponse {
  isOwner: boolean;
}

/**
 * Request payload for setting app permissions.
 */
export interface SetAppPermissionsRequest {
  appId: string;
  permissions: AppPermissions;
}

/**
 * Response payload for setting app permissions (empty on success).
 */
export interface SetAppPermissionsResponse {
  error?: string | undefined;
}

/**
 * Get the permissions for an app.
 *
 * @param appId - The ID of the app to get permissions for
 * @returns The app's permissions
 * @throws NutAPIError if the request fails (e.g., unauthorized, app not found)
 */
export async function getAppPermissions(appId: string): Promise<AppPermissions> {
  if (!appId || typeof appId !== 'string') {
    throw new Error('Invalid appId: must be a non-empty string');
  }

  const request: GetAppPermissionsRequest = { appId };
  const response: GetAppPermissionsResponse = await callNutAPI('get-app-permissions', request);

  return response.permissions || [];
}

/**
 * Get whether the current user is the owner of an app.
 */
export async function isAppOwner(appId: string, userId: string): Promise<boolean> {
  const request: IsAppOwnerRequest = { appId };
  const response: IsAppOwnerResponse = await callNutAPI('is-app-owner', request, undefined, userId);
  return response.isOwner;
}

/**
 * Set the permissions for an app.
 *
 * @param appId - The ID of the app to set permissions for
 * @param permissions - The new permissions to set
 * @throws NutAPIError if the request fails (e.g., unauthorized, invalid permissions)
 */
export async function setAppPermissions(
  appId: string,
  permissions: AppPermissions,
): Promise<SetAppPermissionsResponse> {
  if (!appId || typeof appId !== 'string') {
    throw new Error('Invalid appId: must be a non-empty string');
  }

  if (!Array.isArray(permissions)) {
    throw new Error('Invalid permissions: must be an array');
  }

  // Validate each permission
  for (const permission of permissions) {
    if (!permission.access || !Object.values(AppAccessKind).includes(permission.access)) {
      throw new Error(`Invalid access kind: ${permission.access}`);
    }

    if (!permission.accessor || !Object.values(AppAccessorKind).includes(permission.accessor)) {
      throw new Error(`Invalid accessor kind: ${permission.accessor}`);
    }

    if (typeof permission.allowed !== 'boolean') {
      throw new Error('Invalid permission: allowed must be a boolean');
    }

    // Validate accessorName based on accessor type
    if (permission.accessor === AppAccessorKind.User && !permission.accessorName) {
      throw new Error('User accessor requires an email in accessorName');
    }

    if (permission.accessor === AppAccessorKind.Domain && !permission.accessorName) {
      throw new Error('Domain accessor requires a domain in accessorName');
    }

    if (permission.accessor === AppAccessorKind.Everyone && permission.accessorName) {
      throw new Error('Everyone accessor should not have an accessorName');
    }

    // Basic email validation for User accessor
    if (permission.accessor === AppAccessorKind.User && permission.accessorName) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(permission.accessorName)) {
        throw new Error(`Invalid email format: ${permission.accessorName}`);
      }
    }

    // Basic domain validation for Domain accessor
    if (permission.accessor === AppAccessorKind.Domain && permission.accessorName) {
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(permission.accessorName)) {
        throw new Error(`Invalid domain format: ${permission.accessorName}`);
      }
    }
  }

  const request: SetAppPermissionsRequest = { appId, permissions };
  const response = await callNutAPI('set-app-permissions', request);

  return response;
}

/**
 * Helper function to validate if a user has access based on permissions.
 */
export function isAppAccessAllowed(
  permissions: AppPermissions | undefined,
  accessKind: AppAccessKind,
  userEmail: string,
  userIsOwner: boolean = false,
): boolean {
  // RULE 1: Owner always has full access to everything
  if (userIsOwner) {
    return true;
  }

  // RULE 2: If no permissions defined, deny access to non-owners
  if (!permissions || permissions.length === 0) {
    return false;
  }

  // Extract user's domain from email
  const userDomain = userEmail.includes('@') ? userEmail.split('@')[1] : null;

  // Find all permissions that match this access kind
  const matchingPermissions = permissions.filter((p) => p.access === accessKind);

  // If no permissions defined for this access kind, deny access
  if (matchingPermissions.length === 0) {
    return false;
  }

  // Check permissions in order of specificity (most specific to least specific):
  // 1. Specific User permission (highest priority)
  // 2. Domain permission (medium priority)
  // 3. Everyone permission (lowest priority)

  // 1. Check for specific user permission (most specific)
  const userPermission = matchingPermissions.find(
    (p) => p.accessor === AppAccessorKind.User && p.accessorName === userEmail,
  );

  if (userPermission) {
    // Explicit user permission found - return its allowed value
    return userPermission.allowed;
  }

  // 2. Check for domain permission
  if (userDomain) {
    const domainPermission = matchingPermissions.find(
      (p) => p.accessor === AppAccessorKind.Domain && p.accessorName === userDomain,
    );

    if (domainPermission) {
      // Domain permission found - return its allowed value
      return domainPermission.allowed;
    }
  }

  // 3. Check for everyone permission (least specific)
  const everyonePermission = matchingPermissions.find((p) => p.accessor === AppAccessorKind.Everyone);

  if (everyonePermission) {
    // Everyone permission found - return its allowed value
    return everyonePermission.allowed;
  }

  // No matching permission found for this user - deny access
  return false;
}

import { atom } from 'nanostores';
import type { AppPermissions } from '~/lib/api/permissions';

// Store for tracking the current permissions
export const permissionsStore = atom<AppPermissions>([]);

export const permissionsLoadingStore = atom<boolean>(true);

export const isAppOwnerStore = atom<boolean>(false);

export const isAppOwnerLoadingStore = atom<boolean>(true);

export function setPermissions(permissions: AppPermissions) {
  permissionsStore.set(permissions);
}

export function setPermissionsLoading(permissionsLoading: boolean) {
  permissionsLoadingStore.set(permissionsLoading);
}

export function setIsAppOwner(isOwner: boolean) {
  isAppOwnerStore.set(isOwner);
}

export function setIsAppOwnerLoading(isOwnerLoading: boolean) {
  isAppOwnerLoadingStore.set(isOwnerLoading);
}

import { atom } from 'nanostores';

export const unauthorizedStore = atom<boolean>(false);

export const authorizedCopyStore = atom<boolean>(true);

export const readyStore = atom<boolean>(false);

export const isCopyingStore = atom<boolean>(false);

export function setIsCopying(isCopying: boolean) {
  isCopyingStore.set(isCopying);
}

export function setReady(ready: boolean) {
  readyStore.set(ready);
}

export function setUnauthorized(unauthorized: boolean) {
  unauthorizedStore.set(unauthorized);
}

export function setAuthorizedCopy(authorizedCopy: boolean) {
  authorizedCopyStore.set(authorizedCopy);
}

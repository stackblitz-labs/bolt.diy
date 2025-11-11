import { atom } from 'nanostores';
import { type AppSummary, type AppFeature } from '~/lib/persistence/messageAppSummary';

export type AppCardModalType = 'project-description' | 'features' | 'secrets' | 'auth';

interface AppCardModalState {
  isOpen: boolean;
  type: AppCardModalType;
  appSummary?: AppSummary;
  feature?: AppFeature;
}

export const appCardModalStore = atom<AppCardModalState>({
  isOpen: false,
  type: 'project-description',
  appSummary: undefined,
  feature: undefined,
});

export const openAppCardModal = (type: AppCardModalType, appSummary: AppSummary, feature?: AppFeature) => {
  appCardModalStore.set({
    isOpen: true,
    type,
    appSummary,
    feature,
  });
};

export const closeAppCardModal = () => {
  appCardModalStore.set({
    isOpen: false,
    type: 'project-description',
    appSummary: undefined,
    feature: undefined,
  });
};

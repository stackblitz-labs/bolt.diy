import { atom } from 'nanostores';

export const kExperimentalFeatures = 'nut_experimental_features';

interface ExperimentalFeatures {
  bugReports?: boolean;
}

export const experimentalFeaturesStore = atom<ExperimentalFeatures>(initStore());

function initStore(): ExperimentalFeatures {
  if (!import.meta.env.SSR) {
    const persistedFeatures = localStorage.getItem(kExperimentalFeatures);
    return persistedFeatures ? JSON.parse(persistedFeatures) : {};
  }

  return {};
}

export function setExperimentalFeatures(features: ExperimentalFeatures) {
  experimentalFeaturesStore.set(features);
  localStorage.setItem(kExperimentalFeatures, JSON.stringify(features));
}

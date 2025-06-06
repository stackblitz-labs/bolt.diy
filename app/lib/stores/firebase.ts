import { atom } from 'nanostores';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('firebase_config') : null;

export const firebaseConfig = atom<FirebaseConfig>(
  saved ? JSON.parse(saved) : { apiKey: '', authDomain: '', projectId: '' },
);

export function updateFirebaseConfig(config: Partial<FirebaseConfig>) {
  const current = firebaseConfig.get();
  const newConfig = { ...current, ...config };
  firebaseConfig.set(newConfig);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('firebase_config', JSON.stringify(newConfig));
  }
}

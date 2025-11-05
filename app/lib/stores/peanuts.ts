import { atom } from 'nanostores';
import { getCurrentUserId } from '~/lib/supabase/client';
import { getPeanutsRemaining } from '~/lib/replay/Account';

// Store with state indicating whether app development is possible.
export class PeanutsStore {
  peanutsRemaining = atom<number | undefined>(undefined);

  // Replaces continue building button titles.
  peanutsErrorButton = atom<string | undefined>(undefined);

  // Longer status message for the continue building button.
  peanutsErrorInfo = atom<string | undefined>(undefined);
}

export const peanutsStore = new PeanutsStore();

export async function refreshPeanutsStore() {
  const userId = getCurrentUserId();
  const peanuts = userId ? await getPeanutsRemaining() : undefined;
  peanutsStore.peanutsRemaining.set(peanuts);
  if (peanuts && peanuts > 0) {
    peanutsStore.peanutsErrorButton.set(undefined);
    peanutsStore.peanutsErrorInfo.set(undefined);
  } else if (userId) {
    peanutsStore.peanutsErrorButton.set('Out of Peanuts');
    peanutsStore.peanutsErrorInfo.set('Add peanuts to your account to continue building.');
  } else {
    peanutsStore.peanutsErrorButton.set('Not Logged In');
    peanutsStore.peanutsErrorInfo.set('Login to continue building.');
  }
}

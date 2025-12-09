import { atom } from 'nanostores';
import type { AmplifyConnection } from '~/types/deployment';
import { logStore } from './logs';
import { toast } from 'react-toastify';

const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('amplify_connection') : null;

const initialConnection: AmplifyConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: undefined,
      token: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
    };

export const amplifyConnection = atom<AmplifyConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

export const updateAmplifyConnection = (updates: Partial<AmplifyConnection>) => {
  const currentState = amplifyConnection.get();
  const newState = { ...currentState, ...updates };
  amplifyConnection.set(newState);

  if (typeof window !== 'undefined') {
    localStorage.setItem('amplify_connection', JSON.stringify(newState));
  }
};

export async function validateAmplifyCredentials(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // We'll validate by making a test API call
    // This will be done server-side to keep credentials secure
    const response = await fetch('/api/amplify-validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessKeyId, secretAccessKey, region }),
    });

    const data = (await response.json()) as any;
    return { valid: data.valid, error: data.error };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}

export async function fetchAmplifyStats(accessKeyId: string, secretAccessKey: string, region: string) {
  try {
    isFetchingStats.set(true);

    // Fetch apps list via server-side API
    const response = await fetch('/api/amplify-stats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ accessKeyId, secretAccessKey, region }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.status}`);
    }

    const data = (await response.json()) as any;

    const currentState = amplifyConnection.get();
    updateAmplifyConnection({
      ...currentState,
      stats: {
        apps: data.apps || [],
        totalApps: data.apps?.length || 0,
      },
    });
  } catch (error) {
    console.error('Amplify API Error:', error);
    logStore.logError('Failed to fetch Amplify stats', { error });
    toast.error('Failed to fetch Amplify statistics');
  } finally {
    isFetchingStats.set(false);
  }
}


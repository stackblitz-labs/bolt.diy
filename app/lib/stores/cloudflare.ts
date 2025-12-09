import { atom } from 'nanostores';
import type { CloudflareConnection } from '~/types/deployment';
import { logStore } from './logs';
import { toast } from 'react-toastify';

// Initialize with stored connection or environment variable
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('cloudflare_connection') : null;

const envToken = typeof window !== 'undefined' ? import.meta.env.VITE_CLOUDFLARE_API_TOKEN : '';
const envAccountId = typeof window !== 'undefined' ? import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID : '';

const initialConnection: CloudflareConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: undefined,
      token: envToken || '',
      accountId: envAccountId || '',
    };

export const cloudflareConnection = atom<CloudflareConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

export const updateCloudflareConnection = (updates: Partial<CloudflareConnection>) => {
  const currentState = cloudflareConnection.get();
  const newState = { ...currentState, ...updates };
  cloudflareConnection.set(newState);

  if (typeof window !== 'undefined') {
    localStorage.setItem('cloudflare_connection', JSON.stringify(newState));
  }
};

export async function initializeCloudflareConnection() {
  const currentState = cloudflareConnection.get();

  if (currentState.user || !envToken || !envAccountId) {
    return;
  }

  try {
    isConnecting.set(true);

    // Verify token by fetching account details
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${envAccountId}`, {
      headers: {
        Authorization: `Bearer ${envToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to Cloudflare: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    updateCloudflareConnection({
      user: {
        id: data.result.id,
        name: data.result.name,
      },
      token: envToken,
      accountId: envAccountId,
    });

    await fetchCloudflareStats(envToken, envAccountId);
  } catch (error) {
    console.error('Error initializing Cloudflare connection:', error);
    logStore.logError('Failed to initialize Cloudflare connection', { error });
  } finally {
    isConnecting.set(false);
  }
}

export async function fetchCloudflareStats(token: string, accountId: string) {
  try {
    isFetchingStats.set(true);

    // Fetch Workers list
    const workersResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!workersResponse.ok) {
      throw new Error(`Failed to fetch workers: ${workersResponse.status}`);
    }

    const workersData = (await workersResponse.json()) as any;
    const workers = workersData.result || [];

    const currentState = cloudflareConnection.get();
    updateCloudflareConnection({
      ...currentState,
      stats: {
        workers,
        totalWorkers: workers.length,
      },
    });
  } catch (error) {
    console.error('Cloudflare API Error:', error);
    logStore.logError('Failed to fetch Cloudflare stats', { error });
    toast.error('Failed to fetch Cloudflare statistics');
  } finally {
    isFetchingStats.set(false);
  }
}


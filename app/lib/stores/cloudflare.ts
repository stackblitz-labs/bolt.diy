import { atom } from 'nanostores';
import type { CloudflareConnection } from '~/types/deployment';
import { logStore } from './logs';
import { toast } from 'react-toastify';

// Initialize with stored connection only
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('cloudflare_connection') : null;

const initialConnection: CloudflareConnection = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: undefined,
      token: '',
      accountId: '',
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

  if (currentState.user) {
    return;
  }

  try {
    isConnecting.set(true);

    // Call server-side API to initialize with env credentials
    const response = await fetch('/api/cloudflare-init', {
      method: 'POST',
    });

    const data = (await response.json()) as any;

    if (!data.success || !data.user) {
      return; // No env credentials configured
    }

    updateCloudflareConnection({
      user: data.user,
      token: '', // Don't store server token on client
      accountId: data.accountId,
    });

    await fetchCloudflareStats();
  } catch (error) {
    console.error('Error initializing Cloudflare connection:', error);
    logStore.logError('Failed to initialize Cloudflare connection', { error });
  } finally {
    isConnecting.set(false);
  }
}

export async function fetchCloudflareStats() {
  try {
    isFetchingStats.set(true);

    // Call server-side API to fetch stats (uses env credentials)
    const response = await fetch('/api/cloudflare-stats', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workers: ${response.status}`);
    }

    const data = (await response.json()) as any;

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch stats');
    }

    const currentState = cloudflareConnection.get();
    updateCloudflareConnection({
      ...currentState,
      stats: data.stats,
    });
  } catch (error) {
    console.error('Cloudflare API Error:', error);
    logStore.logError('Failed to fetch Cloudflare stats', { error });
    toast.error('Failed to fetch Cloudflare statistics');
  } finally {
    isFetchingStats.set(false);
  }
}

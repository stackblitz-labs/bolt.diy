import { atom } from 'nanostores';
import type { CloudflareConnection, CloudflareProject } from '~/types/cloudflare';
import { logStore } from './logs';
import { toast } from 'react-toastify';

const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('cloudflare_connection') : null;

const envToken = import.meta.env.VITE_CLOUDFLARE_API_TOKEN;
const envAccountId = import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID;

const initialConnection: CloudflareConnection = storedConnection
  ? JSON.parse(storedConnection)
  : { accountId: envAccountId || '', token: envToken || '', projects: undefined };

export const cloudflareConnection = atom<CloudflareConnection>(initialConnection);
export const isConnecting = atom<boolean>(false);

export const updateCloudflareConnection = (updates: Partial<CloudflareConnection>) => {
  const current = cloudflareConnection.get();
  const newState = { ...current, ...updates };
  cloudflareConnection.set(newState);

  if (typeof window !== 'undefined') {
    localStorage.setItem('cloudflare_connection', JSON.stringify(newState));
  }
};

export async function fetchCloudflareProjects(token: string, accountId: string) {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const data = (await response.json()) as any;
    updateCloudflareConnection({ projects: data.result as CloudflareProject[] });
  } catch (error) {
    console.error('Cloudflare API Error:', error);
    logStore.logError('Failed to fetch Cloudflare projects', { error });
    toast.error('Failed to fetch Cloudflare projects');
  }
}

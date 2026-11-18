import { atom } from 'nanostores';
import { toast } from 'react-toastify';
import { logStore } from './logs';
import type { NetlifyConnection, NetlifyConnectionState, NetlifyUser } from '~/types/netlify';

// Initialize with stored connection or environment variable
const storedConnection = typeof window !== 'undefined' ? localStorage.getItem('netlify_connection') : null;
const envToken = import.meta.env.VITE_NETLIFY_ACCESS_TOKEN;
console.log('Netlify store: envToken loaded:', envToken ? '[TOKEN_EXISTS]' : '[NO_TOKEN]');

// If we have an environment token but no stored connection, initialize with the env token
const initialConnection: NetlifyConnectionState = storedConnection
  ? JSON.parse(storedConnection)
  : {
      user: null,
      token: envToken || '',
      stats: undefined,
    };

export const netlifyConnection = atom<NetlifyConnectionState>(initialConnection);
export const isConnecting = atom<boolean>(false);
export const isFetchingStats = atom<boolean>(false);

// Function to initialize Netlify connection with environment token
export async function initializeNetlifyConnection() {
  const currentState = netlifyConnection.get();

  // If we already have a connection or no token, don't try to connect
  if (currentState.user || !envToken) {
    console.log('Netlify: Skipping auto-connect - user exists or no env token');
    return;
  }

  console.log('Netlify: Attempting auto-connection with env token');

  try {
    isConnecting.set(true);

    const response = await fetch('https://api.netlify.com/api/v1/user', {
      headers: {
        Authorization: `Bearer ${envToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to Netlify: ${response.statusText}`);
    }

    const userData = await response.json();

    // Update the connection state
    const connectionData: Partial<NetlifyConnection> = {
      user: userData as NetlifyUser,
      token: envToken,
    };

    // Store in localStorage for persistence
    localStorage.setItem('netlify_connection', JSON.stringify(connectionData));

    // Update the store
    updateNetlifyConnection(connectionData);

    // Fetch initial stats
    await fetchNetlifyStats(envToken);
  } catch (error) {
    console.error('Error initializing Netlify connection:', error);
    logStore.logError('Failed to initialize Netlify connection', { error });
  } finally {
    isConnecting.set(false);
  }
}

export const updateNetlifyConnection = (updates: Partial<NetlifyConnectionState>) => {
  const currentState = netlifyConnection.get();
  const newState = { ...currentState, ...updates };
  netlifyConnection.set(newState);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('netlify_connection', JSON.stringify(newState));
  }
};

export async function fetchNetlifyStats(token: string) {
  try {
    isFetchingStats.set(true);

    const sitesResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sitesResponse.ok) {
      throw new Error(`Failed to fetch sites: ${sitesResponse.status}`);
    }

    const sites = (await sitesResponse.json()) as any;

    const currentState = netlifyConnection.get();
    updateNetlifyConnection({
      ...currentState,
      stats: {
        sites,
        totalSites: sites.length,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Netlify API Error:', error);
    logStore.logError('Failed to fetch Netlify stats', { error });
    toast.error('Failed to fetch Netlify statistics');
  } finally {
    isFetchingStats.set(false);
  }
}

// Export alias for consistency with other stores
export const fetchNetlifyStatsViaAPI = fetchNetlifyStats;

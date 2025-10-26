import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { logStore } from '~/lib/stores/logs';
import {
  supabaseConnection,
  isConnecting,
  isFetchingStats,
  isFetchingApiKeys,
  updateSupabaseConnection,
  fetchProjectApiKeys,
  initializeSupabaseConnection,
} from '~/lib/stores/supabase';

export function useSupabaseConnection() {
  const connection = useStore(supabaseConnection);
  const connecting = useStore(isConnecting);
  const fetchingStats = useStore(isFetchingStats);
  const fetchingApiKeys = useStore(isFetchingApiKeys);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const initConnection = async () => {
      console.log('useSupabaseConnection: Initializing connection...');

      // First, try to initialize from server-side token
      try {
        await initializeSupabaseConnection();
        console.log('useSupabaseConnection: Server-side initialization completed');
      } catch {
        console.log('useSupabaseConnection: Server-side initialization failed, trying localStorage');
      }

      // Then check localStorage for additional data
      const savedConnection = localStorage.getItem('supabase_connection');
      const savedCredentials = localStorage.getItem('supabaseCredentials');

      if (savedConnection) {
        console.log('useSupabaseConnection: Loading from localStorage');

        const parsed = JSON.parse(savedConnection);

        if (savedCredentials && !parsed.credentials) {
          parsed.credentials = JSON.parse(savedCredentials);
        }

        // Only update if we don't already have a connection from server-side
        const currentState = supabaseConnection.get();

        if (!currentState.user) {
          updateSupabaseConnection(parsed);
        }

        if (parsed.token && parsed.selectedProjectId && !parsed.credentials) {
          fetchProjectApiKeys(parsed.selectedProjectId, parsed.token).catch(console.error);
        }
      }
    };

    initConnection();
  }, []);

  const handleConnect = async () => {
    isConnecting.set(true);

    try {
      const cleanToken = connection.token.trim();

      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: cleanToken,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      updateSupabaseConnection({
        user: data.user,
        token: connection.token,
        stats: data.stats,
      });

      toast.success('Successfully connected to Supabase');

      setIsProjectsExpanded(true);

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      logStore.logError('Failed to authenticate with Supabase', { error });
      toast.error(error instanceof Error ? error.message : 'Failed to connect to Supabase');
      updateSupabaseConnection({ user: null, token: '' });

      return false;
    } finally {
      isConnecting.set(false);
    }
  };

  const handleDisconnect = () => {
    updateSupabaseConnection({ user: null, token: '' });
    toast.success('Disconnected from Supabase');
    setIsDropdownOpen(false);
  };

  const selectProject = async (projectId: string) => {
    const currentState = supabaseConnection.get();
    let projectData = undefined;

    if (projectId && currentState.stats?.projects) {
      projectData = currentState.stats.projects.find((project) => project.id === projectId);
    }

    updateSupabaseConnection({
      selectedProjectId: projectId,
      project: projectData,
    });

    if (projectId && currentState.token) {
      try {
        await fetchProjectApiKeys(projectId, currentState.token);
        toast.success('Project selected successfully');
      } catch (error) {
        console.error('Failed to fetch API keys:', error);
        toast.error('Selected project but failed to fetch API keys');
      }
    } else {
      toast.success('Project selected successfully');
    }

    setIsDropdownOpen(false);
  };

  const handleCreateProject = async () => {
    window.open('https://app.supabase.com/new/new-project', '_blank');
  };

  return {
    connection,
    connecting,
    fetchingStats,
    fetchingApiKeys,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isDropdownOpen,
    setIsDropdownOpen,
    handleConnect,
    handleDisconnect,
    selectProject,
    handleCreateProject,
    updateToken: (token: string) => updateSupabaseConnection({ ...connection, token }),
    isConnected: !!(connection.user && connection.token),
    fetchProjectApiKeys: (projectId: string) => {
      if (connection.token) {
        return fetchProjectApiKeys(projectId, connection.token);
      }

      return Promise.reject(new Error('No token available'));
    },
  };
}

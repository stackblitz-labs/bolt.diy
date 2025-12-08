import { useEffect, useState } from 'react';

interface UseOAuthForVibeAppProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  iframeUrl: string | undefined;
  setIframeUrl: (url: string) => void;
  setUrl: (url: string) => void;
  reloadPreview: (route?: string) => void;
  previewURL: string | undefined;
}

export function useVibeAppAuthPopup({
  iframeRef,
  iframeUrl,
  setIframeUrl,
  setUrl,
  reloadPreview,
  previewURL,
}: UseOAuthForVibeAppProps) {
  useEffect(() => {
    let popup: Window | null = null;
    const handleIframeMessage = async (e: MessageEvent) => {
      if (e.data.type === 'oauth-request') {
        // We will redirect back to nut.new in this case.
        const currentOrigin = window.location.origin;
        const customRedirectUrl = `${currentOrigin}/auth/callback.html?callback_url=${encodeURIComponent(e.data.origin)}/auth/callback`;

        // Construct the OAuth URL directly (no Supabase)
        let appId = e.data.appId;

        // If appId is not set, try to extract it from the current URL
        if (!appId) {
          const currentPath = window.location.pathname;
          const appIdMatch = currentPath.match(/^\/app\/([^\/]+)/);
          if (appIdMatch) {
            appId = appIdMatch[1];
          }
        }

        const provider = encodeURIComponent(e.data.provider);
        const oauthUrl = `https://auth.nut.new/functions/v1/oauth/start?app_id=${encodeURIComponent(appId)}&provider=${provider}&redirect_to=${encodeURIComponent(customRedirectUrl)}`;

        // Open OAuth URL in a popup window
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;

        try {
          popup = window.open(
            oauthUrl,
            `${e.data.provider}-auth`,
            `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=yes`,
          );
        } catch (_err) {
          // Do nothing
        }

        // Listen for storage changes to detect auth completion
        const handleStorageChange = (event: StorageEvent) => {
          if (event.key === 'sb-vibe-auth-token' || event.key === 'auth-callback-trigger') {
            const currentSession = localStorage.getItem('sb-vibe-auth-token');
            if (currentSession) {
              const sessionData = JSON.parse(currentSession);
              if (sessionData.access_token) {
                // Valid session detected
                window.removeEventListener('storage', handleStorageChange);
                reloadPreview('/auth/callback');
                popup?.close();
              }
            }
          }
        };

        window.addEventListener('storage', handleStorageChange);
      }
    };

    window.addEventListener('message', handleIframeMessage);
    return () => {
      window.removeEventListener('message', handleIframeMessage);
      if (popup) {
        popup.close();
      }
    };
  }, [iframeRef, iframeUrl, setIframeUrl, setUrl, reloadPreview, previewURL]);
}

export function useVibeAppAuthQuery({
  iframeForceReload,
  setIframeForceReload,
  repositoryId,
  iframeUrl,
  onTokenOrRepoChange,
}: {
  iframeForceReload: number;
  setIframeForceReload: (forceReload: number) => void;
  repositoryId?: string;
  iframeUrl?: string;
  onTokenOrRepoChange?: (params: URLSearchParams) => void;
}) {
  const [vibeAuthTokenParams, setVibeAuthTokenParams] = useState<URLSearchParams | null>(null);
  const [previousToken, setPreviousToken] = useState<string | null>(null);
  const [previousRepoId, setPreviousRepoId] = useState<string | undefined>(undefined);

  useEffect(() => {
    function queryLocalstorageForVibeToken() {
      const vibeAuthToken = localStorage.getItem('sb-vibe-auth-token') ?? '{}';

      if (vibeAuthToken !== '{}') {
        const vibeAuthTokenJson = JSON.parse(vibeAuthToken);
        const currentAccessToken = vibeAuthTokenJson.access_token;

        // Check if token or repository has changed
        const tokenChanged = previousToken !== null && previousToken !== currentAccessToken;
        const repoChanged = previousRepoId !== undefined && previousRepoId !== repositoryId;

        if (tokenChanged || repoChanged) {
          // Notify parent to redirect iframe to /auth/callback with the new token
          const params = new URLSearchParams(vibeAuthTokenJson);
          if (onTokenOrRepoChange && iframeUrl) {
            onTokenOrRepoChange(params);
          }
          setPreviousToken(currentAccessToken);
          setPreviousRepoId(repositoryId);
          setIframeForceReload(iframeForceReload + 1);
          return;
        }

        const nextParams = new URLSearchParams(vibeAuthTokenJson);
        // Avoid triggering renders with a new-but-equal object
        setVibeAuthTokenParams((prevParams) => {
          if (prevParams && prevParams.toString() === nextParams.toString()) {
            return prevParams;
          }
          return nextParams;
        });
        setPreviousToken(currentAccessToken);
        setPreviousRepoId(repositoryId);

        // Only force reload on initial load
        if (previousToken === null) {
          setIframeForceReload(iframeForceReload + 1);
        }
      }
    }
    queryLocalstorageForVibeToken();
    const interval = setInterval(queryLocalstorageForVibeToken, 100);
    return () => clearInterval(interval);
  }, [
    repositoryId,
    previousToken,
    previousRepoId,
    iframeForceReload,
    setIframeForceReload,
    onTokenOrRepoChange,
    iframeUrl,
  ]);

  return vibeAuthTokenParams;
}

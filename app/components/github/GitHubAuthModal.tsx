import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogRoot } from '~/components/ui/Dialog';
import { GitHubAuth } from '~/lib/github/GitHubAuth';
import { getGitHubUser } from '~/lib/github/github.client';
import { workbenchStore } from '~/lib/stores/workbench';

interface GitHubAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthComplete?: (token: string) => void;
}

export function GitHubAuthModal({ isOpen, onClose, onAuthComplete }: GitHubAuthModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [repoName, setRepoName] = useState('bolt-generated-project');
  const [user, setUser] = useState<{ login: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const handleAuthComplete = useCallback(async (authToken: string) => {
    try {
      const githubUser = await getGitHubUser(authToken);
      setUser(githubUser);
      setToken(authToken);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to get GitHub user:', error);
      setError('Failed to get GitHub user info. Please try again.');
    }
  }, []);

  const handleCreateRepo = useCallback(() => {
    if (!repoName.trim()) {
      setError('Repository name is required');
      return;
    }

    if (!user || !token) {
      return;
    }

    workbenchStore.pushToGitHub(repoName, user.login, token);
    onAuthComplete?.(token);
    onClose();
  }, [repoName, user, token, onAuthComplete, onClose]);

  const handleError = useCallback((error: Error) => {
    setError(error.message);
  }, []);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsAuthenticated(false);
      setRepoName('bolt-generated-project');
      setUser(null);
      setToken(null);
    }
  }, [isOpen]);

  return (
    <DialogRoot open={isOpen}>
      <Dialog onClose={onClose}>
        <div className="w-full max-w-md p-6">
          <h3 className="text-lg font-medium leading-6 text-bolt-elements-textPrimary mb-4">GitHub Authentication</h3>
          {!isAuthenticated ? (
            <>
              <p className="text-sm text-bolt-elements-textSecondary mb-6">
                Authenticate with GitHub to push your project
              </p>
              {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
              <GitHubAuth onAuthComplete={handleAuthComplete} onError={handleError} />
            </>
          ) : (
            <>
              <p className="text-sm text-bolt-elements-textSecondary mb-6">Enter a name for your GitHub repository</p>
              {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
              <div className="flex flex-col gap-4">
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="Repository name"
                  className="w-full px-4 py-2 rounded-lg border border-bolt-elements-border bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleCreateRepo}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Create Repository
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </DialogRoot>
  );
}

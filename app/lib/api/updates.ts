export interface UpdateCheckResult {
  available: boolean;
  version: string;
  releaseNotes?: string;
  error?: {
    type: 'rate_limit' | 'network' | 'auth' | 'unknown';
    message: string;
  };
}

interface PackageJson {
  version: string;
  name: string;
  [key: string]: unknown;
}

function compareVersions(v1: string, v2: string): number {
  // Remove 'v' prefix if present
  const version1 = v1.replace(/^v/, '');
  const version2 = v2.replace(/^v/, '');

  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 !== part2) {
      return part1 - part2;
    }
  }

  return 0;
}

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  try {
    // Get the current version from local package.json
    const packageResponse = await fetch('/package.json');

    if (!packageResponse.ok) {
      throw new Error('Failed to fetch local package.json');
    }

    const packageData = (await packageResponse.json()) as PackageJson;

    if (!packageData.version || typeof packageData.version !== 'string') {
      throw new Error('Invalid package.json format: missing or invalid version');
    }

    const currentVersion = packageData.version;

    /*
     * Get the latest version from GitHub's main branch package.json
     * Using raw.githubusercontent.com which doesn't require authentication
     */
    const latestPackageResponse = await fetch(
      'https://raw.githubusercontent.com/stackblitz-labs/bolt.diy/main/package.json',
    );

    if (!latestPackageResponse.ok) {
      throw new Error(`Failed to fetch latest package.json: ${latestPackageResponse.status}`);
    }

    const latestPackageData = (await latestPackageResponse.json()) as PackageJson;

    if (!latestPackageData.version || typeof latestPackageData.version !== 'string') {
      throw new Error('Invalid remote package.json format: missing or invalid version');
    }

    const latestVersion = latestPackageData.version;

    // Compare versions semantically
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      available: hasUpdate,
      version: latestVersion,
      releaseNotes: hasUpdate ? 'Update available. Check GitHub for release notes.' : undefined,
    };
  } catch (error) {
    console.error('Error checking for updates:', error);

    // Determine error type
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const isNetworkError =
      errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch');

    return {
      available: false,
      version: 'unknown',
      error: {
        type: isNetworkError ? 'network' : 'unknown',
        message: `Failed to check for updates: ${errorMessage}`,
      },
    };
  }
};

export const acknowledgeUpdate = async (version: string): Promise<void> => {
  // Store the acknowledged version in localStorage
  try {
    localStorage.setItem('last_acknowledged_update', version);
  } catch (error) {
    console.error('Failed to store acknowledged version:', error);
  }
};

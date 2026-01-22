import { json } from '@remix-run/cloudflare';
import JSZip from 'jszip';

// Function to detect if we're running in Cloudflare
function isCloudflareEnvironment(context: any): boolean {
  // Check if we're in production AND have Cloudflare Pages specific env vars
  const isProduction = process.env.NODE_ENV === 'production';
  const hasCfPagesVars = !!(
    context?.cloudflare?.env?.CF_PAGES ||
    context?.cloudflare?.env?.CF_PAGES_URL ||
    context?.cloudflare?.env?.CF_PAGES_COMMIT_SHA
  );

  return isProduction && hasCfPagesVars;
}

// Cloudflare-compatible method using GitHub Contents API
async function fetchRepoContentsCloudflare(repo: string, githubToken?: string) {
  const baseUrl = 'https://api.github.com';

  // Get repository info to find default branch
  const repoResponse = await fetch(`${baseUrl}/repos/${repo}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!repoResponse.ok) {
    throw new Error(`Repository not found: ${repo}`);
  }

  const repoData = (await repoResponse.json()) as any;
  const defaultBranch = repoData.default_branch;

  // Get the tree recursively
  const treeResponse = await fetch(`${baseUrl}/repos/${repo}/git/trees/${defaultBranch}?recursive=1`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`);
  }

  const treeData = (await treeResponse.json()) as any;

  // Filter for files only (not directories) and limit size
  const files = treeData.tree.filter((item: any) => {
    if (item.type !== 'blob') {
      return false;
    }

    if (item.path.startsWith('.git/')) {
      return false;
    }

    // Allow lock files even if they're large
    const isLockFile =
      item.path.endsWith('package-lock.json') ||
      item.path.endsWith('yarn.lock') ||
      item.path.endsWith('pnpm-lock.yaml');

    // For non-lock files, limit size to 100KB
    if (!isLockFile && item.size >= 100000) {
      return false;
    }

    return true;
  });

  // Fetch file contents in batches to avoid overwhelming the API
  const batchSize = 10;
  const fileContents = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchPromises = batch.map(async (file: any) => {
      try {
        const contentResponse = await fetch(`${baseUrl}/repos/${repo}/contents/${file.path}`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'bolt.diy-app',
            ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
          },
        });

        if (!contentResponse.ok) {
          console.warn(`Failed to fetch ${file.path}: ${contentResponse.status}`);
          return null;
        }

        const contentData = (await contentResponse.json()) as any;
        const content = atob(contentData.content.replace(/\s/g, ''));

        return {
          name: file.path.split('/').pop() || '',
          path: file.path,
          content,
        };
      } catch (error) {
        console.warn(`Error fetching ${file.path}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    fileContents.push(...batchResults.filter(Boolean));

    // Add a small delay between batches to be respectful to the API
    if (i + batchSize < files.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return fileContents;
}

// Your existing method for non-Cloudflare environments
async function fetchRepoContentsZip(repo: string, githubToken?: string) {
  const baseUrl = 'https://api.github.com';

  // Get the latest release
  const releaseResponse = await fetch(`${baseUrl}/repos/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bolt.diy-app',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!releaseResponse.ok) {
    throw new Error(`GitHub API error: ${releaseResponse.status} - ${releaseResponse.statusText}`);
  }

  const releaseData = (await releaseResponse.json()) as any;
  const zipballUrl = releaseData.zipball_url;

  // Fetch the zipball
  const zipResponse = await fetch(zipballUrl, {
    headers: {
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });

  if (!zipResponse.ok) {
    throw new Error(`Failed to fetch release zipball: ${zipResponse.status}`);
  }

  // Get the zip content as ArrayBuffer
  const zipArrayBuffer = await zipResponse.arrayBuffer();

  // Use JSZip to extract the contents
  const zip = await JSZip.loadAsync(zipArrayBuffer);

  // Find the root folder name
  let rootFolderName = '';
  zip.forEach((relativePath) => {
    if (!rootFolderName && relativePath.includes('/')) {
      rootFolderName = relativePath.split('/')[0];
    }
  });

  // Extract all files
  const promises = Object.keys(zip.files).map(async (filename) => {
    const zipEntry = zip.files[filename];

    // Skip directories
    if (zipEntry.dir) {
      return null;
    }

    // Skip the root folder itself
    if (filename === rootFolderName) {
      return null;
    }

    // Remove the root folder from the path
    let normalizedPath = filename;

    if (rootFolderName && filename.startsWith(rootFolderName + '/')) {
      normalizedPath = filename.substring(rootFolderName.length + 1);
    }

    // Get the file content
    const content = await zipEntry.async('string');

    return {
      name: normalizedPath.split('/').pop() || '',
      path: normalizedPath,
      content,
    };
  });

  const results = await Promise.all(promises);

  return results.filter(Boolean);
}

export async function loader({ request, context }: { request: Request; context: any }) {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');

  if (!repo) {
    return json({ error: 'Repository name is required' }, { status: 400 });
  }

  try {
    // Access environment variables from Cloudflare context or process.env
    const githubToken =
      context?.cloudflare?.env?.GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_ACCESS_TOKEN;

    let fileList;

    if (isCloudflareEnvironment(context)) {
      fileList = await fetchRepoContentsCloudflare(repo, githubToken);
    } else {
      fileList = await fetchRepoContentsZip(repo, githubToken);
    }

    // Filter out .git files for both methods
    const filteredFiles = fileList.filter((file: any) => !file.path.startsWith('.git'));

    return json(filteredFiles);
  } catch (error) {
    console.error('Error processing GitHub template:', error);
    console.error('Repository:', repo);
    console.error('Error details:', error instanceof Error ? error.message : String(error));

    return json(
      {
        error: 'Failed to fetch template files',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

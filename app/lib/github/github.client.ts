export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
  email?: string;
}

interface GitHubRepo {
  name: string;
  owner: {
    login: string;
  };
}

async function githubRequest<T>(endpoint: string, token: string, method = 'GET', body?: any): Promise<T> {
  const url = new URL('/api/github/proxy', window.location.origin);
  url.searchParams.set('endpoint', endpoint);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = new Error('GitHub API request failed') as any;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function getGitHubUser(token: string): Promise<GitHubUser> {
  return githubRequest<GitHubUser>('/user', token);
}

export async function createRepository(token: string, name: string, description?: string): Promise<GitHubRepo> {
  // First create the repository without auto_init
  const repo = await githubRequest<GitHubRepo>('/user/repos', token, 'POST', {
    name,
    description: description || 'Created with Bolt',
    private: false,
    auto_init: false,
  });

  // Create README.md with proper content
  const readmeContent = `# ${name}\n\nThis project was created using bolt.diy, the official open source version of Bolt.new (previously known as oTToDev and bolt.new ANY LLM).`;

  // Encode content in base64
  const content = Buffer.from(readmeContent).toString('base64');

  // Create README.md file
  await githubRequest(`/repos/${repo.owner.login}/${name}/contents/README.md`, token, 'PUT', {
    message: 'Initial commit: Add README.md',
    content,
  });

  // Wait a bit for GitHub to process
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return repo;
}

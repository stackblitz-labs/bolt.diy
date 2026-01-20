---
name: deploy-and-integrations
description: Use when working with deployment or external service integrations. Covers Cloudflare Pages deployment, Vercel/Netlify deploy APIs, GitHub/GitLab integration, wrangler.toml configuration, environment variables, and deployment status updates. Triggers include "deploy", "cloudflare", "vercel", "netlify", "github", "gitlab", "wrangler", "api.vercel-deploy", "api.netlify-deploy", "push to github", "environment variables", "pnpm run deploy", "edge function".
---

# Deployment & Integrations Skill

## Goal

Deploy the application and integrate with external services (Cloudflare, Vercel, Netlify, GitHub, GitLab) following codebase patterns.

## Deployment Targets

| Target | Command | Config |
|--------|---------|--------|
| Cloudflare Pages | `pnpm run deploy` | `wrangler.toml` |
| Vercel | Via API route | `api.vercel-deploy.ts` |
| Netlify | Via API route | `api.netlify-deploy.ts` |
| Docker | `pnpm run dockerbuild` | `Dockerfile` |

## Cloudflare Pages

### Wrangler Configuration

```toml
# wrangler.toml
name = "website-agent"
compatibility_date = "2024-01-01"
pages_build_output_dir = "./build/client"

[vars]
# Non-sensitive environment variables
NODE_ENV = "production"

# Secrets are set via `wrangler secret put SECRET_NAME`
# Never commit secrets to wrangler.toml
```

### Deploy Commands

```bash
# Deploy to Cloudflare Pages
pnpm run deploy

# Generate Wrangler types
pnpm run typegen

# Preview production build locally
pnpm run preview

# Run with Wrangler locally
pnpm run start
```

### Edge Function Constraints

- **30-second timeout** per request
- **Stateless** - no persistent server state
- **SharedArrayBuffer** requires COEP/COOP headers
- Use SSE heartbeats every 5s to keep connections alive

### Environment Variables

```bash
# Set secrets via Wrangler CLI
wrangler secret put OPENAI_API_KEY
wrangler secret put SUPABASE_SERVICE_KEY

# Access in code via context.cloudflare.env
export async function action({ context }: ActionFunctionArgs) {
  const apiKey = context.cloudflare.env.OPENAI_API_KEY;
}
```

## Vercel Deployment API

### Route: `api.vercel-deploy.ts`

```typescript
import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';

interface DeployRequestBody {
  projectId?: string;
  projectInternalId?: string;
  files: Record<string, string>;
  sourceFiles?: Record<string, string>;
  chatId: string;
  framework?: string;
}

export async function action({ request }: ActionFunctionArgs) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return json({ error: 'Missing Vercel token' }, { status: 401 });
  }

  const { files, chatId, projectId } = await request.json<DeployRequestBody>();
  
  // Detect framework from package.json
  const framework = detectFramework(files);
  
  // Create or get Vercel project
  let targetProjectId = projectId;
  if (!targetProjectId) {
    const projectName = `bolt-diy-${chatId}-${Date.now()}`;
    const response = await fetch('https://api.vercel.com/v9/projects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: projectName, framework }),
    });
    
    const newProject = await response.json();
    targetProjectId = newProject.id;
  }

  // Create deployment
  const deployResponse = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName,
      project: targetProjectId,
      target: 'production',
      files: files.map(([path, content]) => ({
        file: path,
        data: content,
      })),
    }),
  });

  // Poll for deployment status
  let deploymentState = '';
  while (deploymentState !== 'READY' && deploymentState !== 'ERROR') {
    const status = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    
    deploymentState = status.readyState;
    await new Promise(r => setTimeout(r, 2000));
  }

  return json({ success: true, url: deploymentUrl });
}
```

### Framework Detection

```typescript
function detectFramework(files: Record<string, string>): string {
  const packageJson = files['package.json'];
  if (packageJson) {
    const pkg = JSON.parse(packageJson);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps.next) return 'nextjs';
    if (deps['@remix-run/react']) return 'remix';
    if (deps.vite) return 'vite';
    if (deps.react) return 'react';
    if (deps.vue) return 'vue';
    if (deps.astro) return 'astro';
    if (deps['@sveltejs/kit']) return 'sveltekit';
  }
  
  // Check config files
  if (files['next.config.js']) return 'nextjs';
  if (files['vite.config.ts']) return 'vite';
  if (files['index.html']) return 'static';
  
  return 'other';
}
```

## Netlify Deployment API

### Route: `api.netlify-deploy.ts`

```typescript
export async function action({ request }: ActionFunctionArgs) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const { siteId, files } = await request.json();
  
  // Create site if needed
  if (!siteId) {
    const site = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: siteName }),
    }).then(r => r.json());
    
    siteId = site.site_id;
  }

  // Create deploy with files
  const deployResponse = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files,
        async: true,
      }),
    }
  );

  return json({ success: true, deploy_url: deployData.deploy_ssl_url });
}
```

## GitHub Integration

### Route: `api.github-branches.ts`

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  return json(await response.json());
}
```

### Push to GitHub (WorkbenchStore)

```typescript
// In workbenchStore.pushToGitHub()
async pushToGitHub(
  repoName: string,
  isPrivate: boolean,
  commitMessage?: string,
) {
  const octokit = new Octokit({ auth: authToken });
  
  // Check if repo exists
  try {
    await octokit.repos.get({ owner, repo: repoName });
  } catch {
    // Create new repo
    await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: isPrivate,
      auto_init: true,
    });
    await new Promise(r => setTimeout(r, 2000)); // Wait for init
  }

  // Create blobs for files
  const blobs = await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const { data } = await octokit.git.createBlob({
        owner, repo: repoName,
        content: Buffer.from(content).toString('base64'),
        encoding: 'base64',
      });
      return { path, sha: data.sha };
    })
  );

  // Create tree
  const { data: tree } = await octokit.git.createTree({
    owner, repo: repoName,
    base_tree: latestCommitSha,
    tree: blobs.map(b => ({
      path: b.path,
      mode: '100644',
      type: 'blob',
      sha: b.sha,
    })),
  });

  // Create commit
  const { data: commit } = await octokit.git.createCommit({
    owner, repo: repoName,
    message: commitMessage || 'Update from website-agent',
    tree: tree.sha,
    parents: [latestCommitSha],
  });

  // Update ref
  await octokit.git.updateRef({
    owner, repo: repoName,
    ref: 'heads/main',
    sha: commit.sha,
  });

  return repo.html_url;
}
```

## GitLab Integration

### GitLabApiService

```typescript
// app/lib/services/gitlabApiService.ts
export class GitLabApiService {
  constructor(private token: string, private baseUrl = 'https://gitlab.com') {}

  async getProject(owner: string, repo: string) {
    const response = await fetch(
      `${this.baseUrl}/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}`,
      { headers: { 'PRIVATE-TOKEN': this.token } }
    );
    return response.ok ? response.json() : null;
  }

  async createProject(name: string, isPrivate: boolean) {
    return fetch(`${this.baseUrl}/api/v4/projects`, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        visibility: isPrivate ? 'private' : 'public',
      }),
    }).then(r => r.json());
  }

  async commitFiles(projectId: number, options: {
    branch: string;
    commit_message: string;
    actions: Array<{ action: string; file_path: string; content: string }>;
  }) {
    return fetch(`${this.baseUrl}/api/v4/projects/${projectId}/repository/commits`, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    }).then(r => r.json());
  }
}
```

## Integration Stores

| Store | Path | Purpose |
|-------|------|---------|
| `githubStore` | `app/lib/stores/github.ts` | GitHub connection state |
| `gitlabConnectionStore` | `app/lib/stores/gitlabConnection.ts` | GitLab connection state |
| `vercelStore` | `app/lib/stores/vercel.ts` | Vercel connection state |
| `netlifyStore` | `app/lib/stores/netlify.ts` | Netlify connection state |
| `cloudflareStore` | `app/lib/stores/cloudflare.ts` | Cloudflare connection state |

## API Routes Reference

| Route | Purpose |
|-------|---------|
| `api.vercel-deploy.ts` | Deploy to Vercel |
| `api.vercel-user.ts` | Get Vercel user info |
| `api.netlify-deploy.ts` | Deploy to Netlify |
| `api.netlify-user.ts` | Get Netlify user info |
| `api.github-branches.ts` | List GitHub branches |
| `api.github-repos.ts` | List GitHub repos |
| `api.gitlab-branches.ts` | List GitLab branches |
| `api.git-info.ts` | Get git repo info |

## Checklist

- [ ] Use `withSecurity()` wrapper for API routes
- [ ] Validate Authorization header before API calls
- [ ] Handle rate limiting (429 responses)
- [ ] Poll for deployment status with timeout
- [ ] Update project status after successful deploy
- [ ] Detect framework from package.json
- [ ] Use Octokit for GitHub API interactions
- [ ] Never log or expose access tokens
- [ ] Handle both new and existing projects
- [ ] Add retry logic for flaky deployments

## References

- `app/routes/api.vercel-deploy.ts` - Vercel deployment
- `app/routes/api.netlify-deploy.ts` - Netlify deployment
- `app/routes/api.github-branches.ts` - GitHub integration
- `app/lib/services/gitlabApiService.ts` - GitLab API service
- `app/lib/stores/workbench.ts` - Push to GitHub/GitLab
- `wrangler.toml` - Cloudflare configuration

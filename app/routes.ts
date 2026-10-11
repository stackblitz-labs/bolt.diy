import type { RouteConfig } from '@react-router/dev/routes';

/*
 * React Router's file-route helper currently pulls CommonJS lodash modules into
 * its ESM config runner, which prevents the dev server from starting. Keep the
 * same flat route URLs in a plain config until the upstream loader handles
 * those dependencies correctly.
 */
export default [
  {
    file: 'routes/_index.tsx',
    children: [
      { file: 'routes/chat-home.tsx', index: true },
      { file: 'routes/chat.$id.tsx', path: 'chat/:id' },
    ],
  },
  { file: 'routes/git.tsx', path: '/git' },
  { file: 'routes/starter.tsx', path: '/starter' },
  { file: 'routes/webcontainer.connect.$id.tsx', path: '/webcontainer/connect/:id' },
  { file: 'routes/webcontainer.preview.$id.tsx', path: '/webcontainer/preview/:id' },
  { file: 'routes/api.bug-report.ts', path: '/api/bug-report' },
  { file: 'routes/api.chat.ts', path: '/api/chat' },
  { file: 'routes/api.check-env-key.ts', path: '/api/check-env-key' },
  { file: 'routes/api.configured-providers.ts', path: '/api/configured-providers' },
  { file: 'routes/api.enhancer.ts', path: '/api/enhancer' },
  { file: 'routes/api.export-api-keys.ts', path: '/api/export-api-keys' },
  { file: 'routes/api.git-info.ts', path: '/api/git-info' },
  { file: 'routes/api.git-proxy.$.ts', path: '/api/git-proxy/*' },
  { file: 'routes/api.github-branches.ts', path: '/api/github-branches' },
  { file: 'routes/api.github-stats.ts', path: '/api/github-stats' },
  { file: 'routes/api.github-template.ts', path: '/api/github-template' },
  { file: 'routes/api.github-user.ts', path: '/api/github-user' },
  { file: 'routes/api.gitlab-branches.ts', path: '/api/gitlab-branches' },
  { file: 'routes/api.gitlab-projects.ts', path: '/api/gitlab-projects' },
  { file: 'routes/api.health.ts', path: '/api/health' },
  { file: 'routes/api.llmcall.ts', path: '/api/llmcall' },
  { file: 'routes/api.mcp-check.ts', path: '/api/mcp-check' },
  { file: 'routes/api.mcp-update-config.ts', path: '/api/mcp-update-config' },
  { file: 'routes/api.models.ts', path: '/api/models' },
  { file: 'routes/api.models.$provider.ts', path: '/api/models/:provider' },
  { file: 'routes/api.netlify-deploy.ts', path: '/api/netlify-deploy' },
  { file: 'routes/api.netlify-user.ts', path: '/api/netlify-user' },
  { file: 'routes/api.supabase.ts', path: '/api/supabase' },
  { file: 'routes/api.supabase.query.ts', path: '/api/supabase/query' },
  { file: 'routes/api.supabase.variables.ts', path: '/api/supabase/variables' },
  { file: 'routes/api.system.diagnostics.ts', path: '/api/system/diagnostics' },
  { file: 'routes/api.system.disk-info.ts', path: '/api/system/disk-info' },
  { file: 'routes/api.system.git-info.ts', path: '/api/system/git-info' },
  { file: 'routes/api.update.ts', path: '/api/update' },
  { file: 'routes/api.vercel-deploy.ts', path: '/api/vercel-deploy' },
  { file: 'routes/api.vercel-user.ts', path: '/api/vercel-user' },
  { file: 'routes/api.web-search.ts', path: '/api/web-search' },
] satisfies RouteConfig;

export const GITHUB_CONFIG = {
  clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
  scope: 'read:user repo',
  proxyUrl: '/api/github/proxy',
  deviceCodeEndpoint: '/login/device/code',
  accessTokenEndpoint: '/login/oauth/access_token',
  userApiUrl: 'https://api.github.com/user',
  pollInterval: 5,
  maxPollAttempts: 12,
} as const;

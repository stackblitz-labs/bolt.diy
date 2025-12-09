import type { TabType } from './types';
import { User, Settings, Bell, Star, Database, Cloud, Laptop, Github, Wrench, List } from 'lucide-react';

// GitLab icon component
const GitLabIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      fill="currentColor"
      d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"
    />
  </svg>
);

// Vercel icon component
const VercelIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path fill="currentColor" d="M12 2L2 19.777h20L12 2z" />
  </svg>
);

// Netlify icon component
const NetlifyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      fill="currentColor"
      d="M16.934 8.519a1.044 1.044 0 0 1 .303-.23l2.349-1.045a.983.983 0 0 1 .905 0c.264.12.49.328.651.599l.518 1.065c.17.35.17.761 0 1.11l-.518 1.065a1.119 1.119 0 0 1-.651.599l-2.35 1.045a1.013 1.013 0 0 1-.904 0l-2.35-1.045a1.119 1.119 0 0 1-.651-.599L13.718 9.02a1.2 1.2 0 0 1 0-1.11l.518-1.065a1.119 1.119 0 0 1 .651-.599l2.35-1.045a.983.983 0 0 1 .697-.061zm-6.051 5.751a1.044 1.044 0 0 1 .303-.23l2.349-1.045a.983.983 0 0 1 .905 0c.264.12.49.328.651.599l.518 1.065c.17.35.17.761 0 1.11l-.518 1.065a1.119 1.119 0 0 1-.651.599l-2.35 1.045a1.013 1.013 0 0 1-.904 0l-2.35-1.045a1.119 1.119 0 0 1-.651-.599l-.518-1.065a1.2 1.2 0 0 1 0-1.11l.518-1.065a1.119 1.119 0 0 1 .651-.599l2.35-1.045a.983.983 0 0 1 .697-.061z"
    />
  </svg>
);

// Supabase icon component
const SupabaseIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      fill="currentColor"
      d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12V21.6a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.656z"
    />
  </svg>
);

// Cloudflare icon component
const CloudflareIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      fill="currentColor"
      d="M14.505 17.44s.396-.02.549-.067c.145-.043.26-.11.357-.25.11-.148.146-.315.145-.428l-.002-.14-.118-1.786c-.005-.08-.017-.208-.126-.366-.117-.166-.28-.267-.433-.33-.16-.064-.298-.056-.372-.048-.087.01-.173.02-.267.04l-11.945 2.64c-.18.04-.337.083-.445.184-.115.104-.17.236-.18.353-.01.128.02.274.112.43.173.294.51.515.873.558l11.85.21zm-1.602-3.297c.076-.092.157-.142.234-.16.076-.018.15-.013.212-.002l.152.026 1.758.27c.08.014.207.03.365-.03.162-.06.273-.178.344-.307.067-.126.078-.252.078-.323l.002-.126-.248-1.652c-.04-.262-.108-.482-.2-.657-.087-.172-.197-.288-.306-.368-.114-.083-.232-.135-.343-.173-.118-.04-.232-.068-.341-.092L6.2 8.164c-.17-.037-.334-.055-.45-.02-.123.036-.2.144-.246.254-.042.107-.057.23-.058.342 0 .122.014.238.025.338l.943 7.013c.04.292.102.526.184.704.077.169.169.285.26.365.095.082.189.134.28.17.096.036.185.058.267.078l6.256 1.254c.27.05.494.066.672.047.174-.02.297-.076.38-.16.09-.087.147-.207.18-.328.034-.13.042-.267.042-.394 0-.137-.014-.267-.028-.378l-.28-2.185c-.006-.072-.01-.18-.06-.34-.064-.205-.202-.412-.456-.59-.267-.19-.582-.246-.836-.275l-2.653-.3c-.104-.01-.22-.03-.346-.122-.134-.095-.223-.237-.265-.393-.04-.15-.027-.3.005-.42.03-.118.076-.22.125-.304z"
    />
  </svg>
);

// Amplify icon component
const AmplifyIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4">
    <path
      fill="currentColor"
      d="M12.975 14.774h4.743L13.97 3.328a.614.614 0 0 0-1.097-.008L8.353 11.75a.614.614 0 0 0 .549.898h2.992l-4.442 7.53a.614.614 0 0 0 .915.78l10.592-10.592a.614.614 0 0 0-.435-1.05h-5.549z"
    />
  </svg>
);

export const TAB_ICONS: Record<TabType, React.ComponentType<{ className?: string }>> = {
  profile: User,
  settings: Settings,
  notifications: Bell,
  features: Star,
  data: Database,
  'cloud-providers': Cloud,
  'local-providers': Laptop,
  github: Github,
  gitlab: () => <GitLabIcon />,
  netlify: () => <NetlifyIcon />,
  vercel: () => <VercelIcon />,
  supabase: () => <SupabaseIcon />,
  cloudflare: () => <CloudflareIcon />,
  amplify: () => <AmplifyIcon />,
  'event-logs': List,
  mcp: Wrench,
};

export const TAB_LABELS: Record<TabType, string> = {
  profile: 'Profile',
  settings: 'Settings',
  notifications: 'Notifications',
  features: 'Features',
  data: 'Data Management',
  'cloud-providers': 'Cloud Providers',
  'local-providers': 'Local Providers',
  github: 'GitHub',
  gitlab: 'GitLab',
  netlify: 'Netlify',
  vercel: 'Vercel',
  supabase: 'Supabase',
  cloudflare: 'Cloudflare',
  amplify: 'AWS Amplify',
  'event-logs': 'Event Logs',
  mcp: 'MCP Servers',
};

export const TAB_DESCRIPTIONS: Record<TabType, string> = {
  profile: 'Manage your profile and account settings',
  settings: 'Configure application preferences',
  notifications: 'View and manage your notifications',
  features: 'Explore new and upcoming features',
  data: 'Manage your data and storage',
  'cloud-providers': 'Configure cloud AI providers and models',
  'local-providers': 'Configure local AI providers and models',
  github: 'Connect and manage GitHub integration',
  gitlab: 'Connect and manage GitLab integration',
  netlify: 'Configure Netlify deployment settings',
  vercel: 'Manage Vercel projects and deployments',
  supabase: 'Setup Supabase database connection',
  cloudflare: 'Deploy to Cloudflare Workers Static Assets',
  amplify: 'Deploy to AWS Amplify Hosting',
  'event-logs': 'View system events and logs',
  mcp: 'Configure MCP (Model Context Protocol) servers',
};

export const DEFAULT_TAB_CONFIG = [
  // User Window Tabs (Always visible by default)
  { id: 'features', visible: true, window: 'user' as const, order: 0 },
  { id: 'data', visible: true, window: 'user' as const, order: 1 },
  { id: 'cloud-providers', visible: true, window: 'user' as const, order: 2 },
  { id: 'local-providers', visible: true, window: 'user' as const, order: 3 },
  { id: 'github', visible: true, window: 'user' as const, order: 4 },
  { id: 'gitlab', visible: true, window: 'user' as const, order: 5 },
  { id: 'netlify', visible: true, window: 'user' as const, order: 6 },
  { id: 'vercel', visible: true, window: 'user' as const, order: 7 },
  { id: 'supabase', visible: true, window: 'user' as const, order: 8 },
  { id: 'cloudflare', visible: true, window: 'user' as const, order: 9 },
  { id: 'amplify', visible: true, window: 'user' as const, order: 10 },
  { id: 'notifications', visible: true, window: 'user' as const, order: 11 },
  { id: 'event-logs', visible: true, window: 'user' as const, order: 12 },
  { id: 'mcp', visible: true, window: 'user' as const, order: 13 },

  // User Window Tabs (In dropdown, initially hidden)
];

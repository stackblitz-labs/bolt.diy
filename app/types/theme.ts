export const THEMES = [
  { id: 'light', name: 'Light', mode: 'light', colors: ['#f8fafc', '#e2e8f0', '#2563eb'] },
  { id: 'light-solarized', name: 'Solarized Light', mode: 'light', colors: ['#fdf6e3', '#eee8d5', '#268bd2'] },
  { id: 'light-nord', name: 'Nord Light', mode: 'light', colors: ['#eceff4', '#d8dee9', '#5e81ac'] },
  { id: 'light-monochrome', name: 'Monochrome', mode: 'light', colors: ['#f5f5f5', '#d4d4d4', '#525252'] },
  { id: 'light-pastel-dreams', name: 'Pastel Dreams', mode: 'light', colors: ['#fff1f5', '#d9f5ef', '#dce8ff'] },
  { id: 'light-easter', name: 'Easter', mode: 'light', colors: ['#fff7f9', '#b7f0c1', '#ff70b5'] },
  { id: 'light-birthday', name: 'Birthday Day Party', mode: 'light', colors: ['#fff7df', '#ffe2eb', '#ff4fa6'] },
  {
    id: 'light-halloween-harvest',
    name: 'Halloween Harvest Light',
    mode: 'light',
    colors: ['#fff8ed', '#f2e4d3', '#e86b27'],
  },
  { id: 'light-sakura-bloom', name: 'Sakura Bloom', mode: 'light', colors: ['#fff7fa', '#fce4ec', '#e75480'] },
  { id: 'light-mint-breeze', name: 'Mint Breeze', mode: 'light', colors: ['#f1fbf7', '#d9f3e8', '#22a982'] },
  { id: 'light-lemonade', name: 'Lemonade', mode: 'light', colors: ['#fffdf0', '#fff2b8', '#d49a13'] },
  { id: 'light-lavender-fields', name: 'Lavender Fields', mode: 'light', colors: ['#faf7ff', '#ece3ff', '#8b5cf6'] },
  { id: 'dark-aurora', name: 'Aurora', mode: 'dark', colors: ['#111827', '#312e81', '#a78bfa'] },
  { id: 'dark-solarized', name: 'Solarized', mode: 'dark', colors: ['#002b36', '#073642', '#2aa198'] },
  { id: 'dark-nord', name: 'Nord', mode: 'dark', colors: ['#2e3440', '#3b4252', '#88c0d0'] },
  { id: 'dark-dracula', name: 'Dracula', mode: 'dark', colors: ['#282a36', '#44475a', '#bd93f9'] },
  { id: 'dark-monokai', name: 'Monokai', mode: 'dark', colors: ['#272822', '#3e3d32', '#a6e22e'] },
  { id: 'dark-tokyo-night', name: 'Tokyo Night', mode: 'dark', colors: ['#1a1b26', '#292e42', '#7aa2f7'] },
  { id: 'dark-birthday', name: 'Birthday Midnight', mode: 'dark', colors: ['#0b0e1c', '#17152d', '#ff4fa6'] },
  { id: 'dark-holiday-cheer', name: 'Holiday Cheer', mode: 'dark', colors: ['#080d12', '#10251c', '#d4a017'] },
  { id: 'dark-halloween-night', name: 'Halloween Night', mode: 'dark', colors: ['#0b0f20', '#1b1534', '#ff6a00'] },
  { id: 'dark-halloween-harvest', name: 'Halloween Harvest', mode: 'dark', colors: ['#1b1112', '#30201c', '#ff843f'] },
  { id: 'dark-cyberpunk-2077', name: 'Cyberpunk 2077', mode: 'dark', colors: ['#111018', '#24202e', '#fcee0a'] },
  { id: 'dark-synthwave', name: 'Synthwave', mode: 'dark', colors: ['#171126', '#291a3d', '#ff4fd8'] },
  { id: 'dark-matrix', name: 'Matrix', mode: 'dark', colors: ['#07130d', '#102219', '#00e676'] },
  { id: 'dark-ocean-depths', name: 'Ocean Depths', mode: 'dark', colors: ['#071923', '#0c2b3a', '#20c6d7'] },
  { id: 'dark-rose-pine', name: 'Rosé Pine', mode: 'dark', colors: ['#191724', '#26233a', '#ebbcba'] },
  { id: 'dark-cappuccino-mocha', name: 'Cappuccino Mocha', mode: 'dark', colors: ['#191513', '#30251f', '#cba6f7'] },
  { id: 'dark-gruvbox', name: 'Gruvbox', mode: 'dark', colors: ['#282828', '#3c3836', '#fabd2f'] },
  { id: 'dark-one-dark-pro', name: 'One Dark Pro', mode: 'dark', colors: ['#21252b', '#282c34', '#61afef'] },
] as const;

export type Theme = (typeof THEMES)[number]['id'] | 'dark';
export type ThemeMode = 'light' | 'dark';

export function getThemeMode(theme: Theme | string): ThemeMode {
  return theme.startsWith('dark-') || theme === 'dark' ? 'dark' : 'light';
}

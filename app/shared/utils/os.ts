// Helper to detect OS
export const isMac = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase().includes('mac') : false;
export const isWindows = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase().includes('win') : false;
export const isLinux = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase().includes('linux') : false;

/**
 * Windows Compatibility Script
 * Handles Windows-specific issues including EOF errors and process management
 * Author: Keoma Wright
 */

const { spawn } = require('child_process');
const os = require('os');

// Detect if running on Windows
const isWindows = os.platform() === 'win32';

/**
 * Gracefully handle process termination on Windows
 */
function setupWindowsHandlers() {
  if (!isWindows) return;

  // Handle Windows-specific signals
  process.on('SIGINT', () => {
    console.log('\n⚡ Gracefully shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n⚡ Terminating process...');
    process.exit(0);
  });

  // Handle uncaught EOF errors on Windows
  process.on('uncaughtException', (error) => {
    if (error.code === 'EOF' || error.message.includes('write EOF')) {
      console.log('⚠️  Detected EOF error, attempting recovery...');
      // Don't exit, let the process continue
      return;
    }
    // Re-throw other errors
    throw error;
  });

  // Prevent unhandled promise rejections from crashing
  process.on('unhandledRejection', (reason, promise) => {
    if (reason && reason.code === 'EOF') {
      console.log('⚠️  Handled EOF in promise rejection');
      return;
    }
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

/**
 * Fix stdin handling on Windows to prevent EOF errors
 */
function fixWindowsStdin() {
  if (!isWindows) return;

  // Set raw mode if TTY is available
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Resume stdin to prevent hanging
  process.stdin.resume();

  // Handle stdin errors gracefully
  process.stdin.on('error', (err) => {
    if (err.code === 'EOF' || err.code === 'EPIPE') {
      // Silently ignore EOF/EPIPE errors
      return;
    }
    console.error('stdin error:', err);
  });
}

/**
 * Spawn a child process with Windows compatibility
 */
function spawnWithWindowsCompat(command, args = [], options = {}) {
  const defaultOptions = {
    stdio: 'inherit',
    shell: isWindows,
    windowsHide: false,
    ...(isWindows && {
      windowsVerbatimArguments: true,
      detached: false,
    }),
  };

  const mergedOptions = { ...defaultOptions, ...options };
  
  const child = spawn(command, args, mergedOptions);

  // Handle child process errors
  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error(`Command not found: ${command}`);
      console.error('Please ensure all dependencies are installed.');
    } else if (err.code === 'EOF') {
      console.log('⚠️  Child process EOF error handled');
    } else {
      console.error('Child process error:', err);
    }
  });

  return child;
}

/**
 * Initialize Windows compatibility fixes
 */
function initWindowsCompat() {
  if (!isWindows) {
    return;
  }

  console.log('🪟 Windows detected, applying compatibility fixes...');
  
  setupWindowsHandlers();
  fixWindowsStdin();
  
  // Set environment variables for better Windows compatibility
  process.env.FORCE_COLOR = '1';
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  
  console.log('✅ Windows compatibility fixes applied');
}

module.exports = {
  isWindows,
  setupWindowsHandlers,
  fixWindowsStdin,
  spawnWithWindowsCompat,
  initWindowsCompat,
};
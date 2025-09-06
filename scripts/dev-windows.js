#!/usr/bin/env node
/**
 * Windows Development Server Runner
 * Handles Windows-specific startup issues including EOF errors
 * Author: Keoma Wright
 */

const { spawn } = require('child_process');
const { initWindowsCompat, spawnWithWindowsCompat } = require('./windows-compat.js');

// Initialize Windows compatibility
initWindowsCompat();

console.log('🚀 Starting Bolt.diy development server on Windows...\n');

// Run pre-start script first
const preStart = spawnWithWindowsCompat('node', ['pre-start.cjs'], {
  stdio: 'inherit',
  shell: false,
});

preStart.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Pre-start script failed with code ${code}`);
    process.exit(code);
  }

  // After pre-start completes, run the Remix dev server
  console.log('\n📦 Starting Remix development server...\n');
  
  const remixDev = spawnWithWindowsCompat('npx', ['remix', 'vite:dev'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      NODE_ENV: 'development',
    },
  });

  // Handle server process events
  remixDev.on('error', (err) => {
    if (err.code === 'EOF' || err.errno === -4095) {
      console.log('⚠️  Handled EOF error, server continuing...');
      return;
    }
    console.error('Server error:', err);
    process.exit(1);
  });

  remixDev.on('exit', (code, signal) => {
    if (signal) {
      console.log(`\n⚡ Server terminated by signal ${signal}`);
    } else if (code !== 0 && code !== null) {
      console.log(`\n⚡ Server exited with code ${code}`);
    }
    process.exit(code || 0);
  });

  // Forward signals to child process
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      remixDev.kill(signal);
    });
  });
});
#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the root directory where the package is installed
const rootDir = join(__dirname, '..');


const BUILT_APP_PATH = join(rootDir, 'build');
const FUNCTIONS_PATH = join(rootDir, 'functions');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  port: 5173, // default port
  help: false,
  version: false,
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  switch (arg) {
    case '--help':
    case '-h':
      options.help = true;
      break;
    case '--version':
    case '-v':
      options.version = true;
      break;
    case '--port':
    case '-p':
      const port = parseInt(args[i + 1]);
      if (isNaN(port)) {
        console.error('Error: Port must be a number');
        process.exit(1);
      }
      options.port = port;
      i++; // Skip the next argument since it's the port number
      break;
  }
}

async function getVersion() {
  try {
    const fs = await import('fs/promises');
    const packageJson = JSON.parse(await fs.readFile(join(rootDir, 'package.json'), 'utf8'));
    return packageJson.version;
  } catch (e) {
    console.error('Error reading package.json:', e);
    return 'undefined';
  }
}

function showHelp() {
  console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
         Usage Instructions
★═══════════════════════════════════════★

Options:
  -h, --help      Show this help message
  -v, --version   Show the current version
  -p, --port      Specify a custom port (default: 5173)

Examples:
  bolt              Start with default settings
  bolt --port 3000  Start on port 3000
  bolt --help       Show this help message
  bolt --version    Show version information

For more information, visit: https://github.com/stackblitz-labs/bolt.diy
`);
}

async function showVersion() {
  const version = await getVersion();
  let commitHash;
  try {
    commitHash = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (e) {
    commitHash = undefined;
  }

  console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
★═══════════════════════════════════════★
Version: ${version}
${commitHash ? `Commit:  ${commitHash}\n` : ''}`);
}

async function displayBanner() {
  const version = await getVersion();
  let commitHash;
  try {
    commitHash = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch (e) {
    commitHash = 'unknown';
  }

  console.log('★═══════════════════════════════════════★');
  console.log('          B O L T . D I Y');
  console.log('         ⚡️  Welcome  ⚡️');
  console.log('★═══════════════════════════════════════★');
  console.log(`📍 Current Version Tag: v${version}`);
  console.log(`📍 Starting on port: ${options.port}`);
  console.log('  Please wait until the URL appears here');
  console.log('★═══════════════════════════════════════★');
}

async function startApp() {
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    await showVersion();
    process.exit(0);
  }

  await displayBanner();

  try {
    // First build the app
    // await buildApp();

    
    // Use wrangler from node_modules
    const wranglerBinPath = join(rootDir, 'node_modules', '.bin', 'wrangler');

    let buildPath = join(rootDir, 'build/client');

    // Start wrangler pages dev with the build directory
    const devProcess = spawn(
      wranglerBinPath,
      [
        'pages',
        'dev',
        // '--build-output-dir',
        buildPath,
        // './build', // assuming this is your build output directory
        '--port',
        options.port.toString(),
        '--compatibility-flag',
        'nodejs_compat',
        '--compatibility-date',
        '2024-07-01',
        '--proxy',
        options.port.toString(),
        '--binding',
        'ENVIRONMENT=development',
      ],
      {
        cwd: rootDir,
        stdio: 'inherit',
        shell: true,
        env: {
          ...process.env,
          PORT: options.port.toString(),
          PATH: `${join(rootDir, 'node_modules', '.bin')}:${process.env.PATH}`,
          WRANGLER_FUNCTIONS_DIR: FUNCTIONS_PATH,
          WRANGLER_PUBLIC_DIR: BUILT_APP_PATH,
          PORT: options.port.toString(),
          NODE_ENV: 'production',
        },
      },
    );

    devProcess.on('error', (err) => {
      console.error('Failed to start development server:', err);
      if (err.code === 'ENOENT') {
        console.error('\nError: Required dependencies not found. Please ensure you have run:');
        console.error('npm install\n');
      }
      process.exit(1);
    });

    // Handle interruption signals
    process.on('SIGINT', () => {
      devProcess.kill('SIGINT');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      devProcess.kill('SIGTERM');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error starting the application:', error);
    process.exit(1);
  }
}

startApp();

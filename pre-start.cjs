const { execSync } = require('child_process');

// CRITICAL: Force Node.js mode for postgres-js to prevent Cloudflare Workers detection
// This prevents postgres-js from trying to use cloudflare: protocol imports
process.env.POSTGRES_JS_RUNTIME = 'node';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Remove Cloudflare-specific environment variables that might confuse postgres-js
delete process.env.CF_PAGES;
delete process.env.CF_PAGES_BRANCH;
delete process.env.CF_PAGES_COMMIT_SHA;
delete process.env.CF_PAGES_URL;

// Get git hash with fallback
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'no-git-info';
  }
};

let commitJson = {
  hash: JSON.stringify(getGitHash()),
  version: JSON.stringify(process.env.npm_package_version),
};

console.log(`
★═══════════════════════════════════════★
          B O L T . D I Y
         ⚡️  Welcome  ⚡️
★═══════════════════════════════════════★
`);
console.log('📍 Current Version Tag:', `v${commitJson.version}`);
console.log('📍 Current Commit Version:', commitJson.hash);
console.log('  Please wait until the URL appears here');
console.log('★═══════════════════════════════════════★');

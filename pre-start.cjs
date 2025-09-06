const { execSync } = require('child_process');
const { initWindowsCompat } = require('./scripts/windows-compat.js');

// Initialize Windows compatibility fixes
initWindowsCompat();

// Get git hash with fallback
const getGitHash = () => {
  try {
    // Add Windows-specific options to prevent EOF errors
    const options = process.platform === 'win32' 
      ? { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }
      : {};
    return execSync('git rev-parse --short HEAD', options).toString().trim();
  } catch (error) {
    // Handle Windows-specific errors gracefully
    if (error.code === 'EOF' || error.errno === -4095) {
      console.log('⚠️  Git command failed (EOF), using fallback');
    }
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

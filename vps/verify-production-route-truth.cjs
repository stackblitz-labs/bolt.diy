'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = __dirname;
const sitesPath = path.join(root, 'daveai-sites-config.json');
const outputFlag = process.argv.indexOf('--output');
const outputPath = outputFlag >= 0 ? process.argv[outputFlag + 1] : '';
const document = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
const sites = document.sites || [];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function check(site) {
  const before = Date.now();
  try {
    const response = await fetch(site.url, {
      redirect: 'manual',
      headers: {
        'Cache-Control': 'no-cache',
        'User-Agent': 'DaveAI-Route-Truth/1.0',
      },
      signal: AbortSignal.timeout(12000),
    });
    const location = response.headers.get('location') || '';
    let finalHttpStatus = response.status;
    let finalUrl = response.url;
    if (site.status === 'live' && [301, 302, 303, 307, 308].includes(response.status)) {
      const followed = await fetch(site.url, {
        redirect: 'follow',
        headers: {
          'Cache-Control': 'no-cache',
          'User-Agent': 'DaveAI-Route-Truth/1.0',
        },
        signal: AbortSignal.timeout(12000),
      });
      finalHttpStatus = followed.status;
      finalUrl = followed.url;
    }
    const livePassed = site.status === 'live' && finalHttpStatus === 200;
    const authPassed = site.status === 'auth'
      && [302, 303, 307, 308].includes(response.status)
      && location.startsWith('https://auth.daveai.tech/');
    return {
      domain: site.domain,
      label: site.status,
      url: site.url,
      httpStatus: response.status,
      location: location || null,
      finalHttpStatus,
      finalUrl,
      latencyMs: Date.now() - before,
      passed: livePassed || authPassed,
    };
  } catch (error) {
    return {
      domain: site.domain,
      label: site.status,
      url: site.url,
      httpStatus: 0,
      location: null,
      latencyMs: Date.now() - before,
      passed: false,
      error: error.name === 'TimeoutError' ? 'timeout' : error.message,
    };
  }
}

async function main() {
  if (sites.length !== 22) throw new Error(`Expected 22 sites, found ${sites.length}`);
  if (sites.some((site) => site.status === 'soon')) throw new Error('A soon route remains in the source catalog');
  const results = await Promise.all(sites.map(check));
  const counts = results.reduce((summary, result) => {
    summary[result.label] = (summary[result.label] || 0) + 1;
    return summary;
  }, {});
  const failed = results.filter((result) => !result.passed);
  const proof = {
    schema: 'daveai-route-truth-proof/v1',
    checkedAt: new Date().toISOString(),
    sitesConfigSha256: sha256(sitesPath),
    counts,
    passed: failed.length === 0 && counts.live === 14 && counts.auth === 8,
    failed: failed.map((result) => result.domain),
    results,
  };
  const serialized = `${JSON.stringify(proof, null, 2)}\n`;
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(outputPath, serialized);
  }
  process.stdout.write(serialized);
  if (!proof.passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});

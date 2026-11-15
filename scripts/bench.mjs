#!/usr/bin/env node
import { spawn, execSync } from 'child_process';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';

const label = process.argv[3] || 'initial';
const iters = Math.max(1, Number(process.argv[4]) || 3);

function killTree(pid) {
  if (os.platform() === 'win32') execSync(`taskkill /F /T /PID ${pid}`);
  else { try { process.kill(-pid, 'SIGKILL') } catch (_) {} }
}

function waitHttp(url, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let attempts = 0;
    const maxAttempts = Math.ceil(timeoutMs / 200);
    const id = setInterval(() => {
      attempts++;
      const req = http.get(url, (res) => { res.resume(); if (res.statusCode === 200) { clearInterval(id); resolve({ ms: Math.round(performance.now() - start), status: res.statusCode }); } });
      req.on('error', () => {});
      if (attempts >= maxAttempts) { clearInterval(id); reject(new Error('timeout')); }
    }, 200);
  });
}

async function runIter(bench) {
  switch (bench) {
    case 'build': {
      const t0 = performance.now(); execSync('pnpm build', { stdio: 'pipe' }); const t1 = performance.now();
      return { ms: Math.round(t1 - t0), ok: true };
    }
    case 'test': {
      const t0 = performance.now(); execSync('pnpm exec vitest --run', { stdio: 'pipe' }); const t1 = performance.now();
      return { ms: Math.round(t1 - t0), ok: true };
    }
    case 'typecheck': {
      let errCount = 0;
      try { execSync('pnpm typecheck', { stdio: 'pipe' }); } catch (e) {
        const m = e.stderr?.match(/error TS/g);
        errCount = m ? m.length : 0;
      }
      const t0 = performance.now(); execSync('pnpm typecheck', { stdio: 'pipe' }); const t1 = performance.now();
      return { ms: Math.round(t1 - t0), errors: errCount, ok: true };
    }
  }
}

async function main() {
  const results = {};
  for (const bench of ['build', 'test', 'typecheck']) {
    const samples = [];
    for (let i = 0; i < iters; i++) {
      const r = await runIter(bench);
      if (r && r.ok) samples.push(r);
    }
    if (samples.length > 0) {
      const medians = samples.map(s => s.ms).sort((a, b) => a - b);
      const median = medians[Math.floor(medians.length / 2)];
      results[bench] = { medianMs: median, samples };
    } else {
      results[bench] = { medianMs: null, samples: 0, note: 'failed or skipped' };
    }
  }
  fs.mkdirSync('benchmarks', { recursive: true });
  fs.writeFileSync(path.join('benchmarks', `${label}.json`), JSON.stringify(results, null, 2));
  console.log('Baseline results:', JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
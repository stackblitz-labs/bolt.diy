#!/usr/bin/env node
/**
 * Setup wizard for bolt.diy local installs.
 *
 * Goals:
 * - Make initial configuration repeatable (init .env.local, optionally sync .env for Docker Compose).
 * - Allow users to set any env key via CLI flags or an interactive prompt (without echoing secrets).
 *
 * This is intentionally dependency-free and cross-platform (Node-based).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

const ENV_EXAMPLE = path.join(ROOT_DIR, '.env.example');
const ENV_LOCAL = path.join(ROOT_DIR, '.env.local');
const ENV_DOCKER = path.join(ROOT_DIR, '.env');

function usage() {
  return `
Usage:
  pnpm run setup                 # interactive wizard (default)
  pnpm run setup -- --help       # show help

Commands:
  --init                         Create .env.local from .env.example (no overwrite)
  --sync                         Copy .env.local -> .env (Docker Compose compatibility)
  --force                        Allow overwriting .env.local on --init
  --list                         List known keys (parsed from .env.example)
  --set KEY=VALUE                Set a key in .env.local (repeatable)
  --unset KEY                    Remove a key from .env.local (repeatable)
  --interactive                  Run the wizard explicitly

Notes:
  - .env.local is gitignored; this script never writes secrets into tracked files.
  - Passing secrets via --set can leak into your shell history. Prefer interactive mode for API keys.
`.trim();
}

function isSensitiveKey(key) {
  const k = key.toUpperCase();
  return (
    k.includes('KEY') ||
    k.includes('TOKEN') ||
    k.includes('SECRET') ||
    k.includes('PASSWORD') ||
    k.includes('AUTH')
  );
}

function quoteEnvValue(value) {
  // Keep simple values unquoted for readability.
  if (value === '' || /^[A-Za-z0-9_./:@+-]+$/.test(value)) {
    return value;
  }

  // Escape backslashes and double-quotes.
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractKeysFromEnvExample(contents) {
  const keys = [];

  for (const line of contents.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=/);

    if (match) {
      keys.push(match[1]);
    }
  }

  return Array.from(new Set(keys));
}

function parseEnvLines(contents) {
  const lines = contents.split('\n');
  const indexByKey = new Map();
  const valueByKey = new Map();

  lines.forEach((line, i) => {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) return;

    const key = match[1];
    let value = match[2] ?? '';

    // Strip surrounding quotes if present (basic).
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    indexByKey.set(key, i);
    valueByKey.set(key, value);
  });

  return { lines, indexByKey, valueByKey };
}

async function readEnvFile(filePath) {
  if (!(await fileExists(filePath))) {
    return parseEnvLines('');
  }

  const contents = await fs.readFile(filePath, 'utf8');
  return parseEnvLines(contents);
}

async function writeEnvFile(filePath, parsed) {
  const out = parsed.lines.join('\n');
  await fs.writeFile(filePath, out, 'utf8');
}

function setEnvKey(parsed, key, value) {
  const formatted = `${key}=${quoteEnvValue(value)}`;

  if (parsed.indexByKey.has(key)) {
    const idx = parsed.indexByKey.get(key);
    parsed.lines[idx] = formatted;
  } else {
    // Keep a trailing newline by appending to the end (but avoid leading blank file).
    if (parsed.lines.length === 1 && parsed.lines[0] === '') {
      parsed.lines[0] = formatted;
    } else {
      parsed.lines.push(formatted);
    }
    parsed.indexByKey.set(key, parsed.lines.length - 1);
  }

  parsed.valueByKey.set(key, value);
}

function unsetEnvKey(parsed, key) {
  if (!parsed.indexByKey.has(key)) {
    return;
  }

  const idx = parsed.indexByKey.get(key);
  parsed.lines.splice(idx, 1);
  parsed.indexByKey.delete(key);
  parsed.valueByKey.delete(key);

  // Rebuild indexes after splice.
  const rebuilt = parseEnvLines(parsed.lines.join('\n'));
  parsed.lines = rebuilt.lines;
  parsed.indexByKey = rebuilt.indexByKey;
  parsed.valueByKey = rebuilt.valueByKey;
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
}

function question(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

function questionHidden(rl, prompt) {
  // Minimal masking approach without external deps.
  // Uses readline's private _writeToOutput hook; if that ever breaks, fall back to normal prompts.
  return new Promise((resolve) => {
    const rlAny = rl;
    const original = rlAny._writeToOutput;
    rlAny._writeToOutput = function maskedWrite(stringToWrite) {
      // Hide typed characters but keep backspaces/line breaks functional.
      if (rlAny.stdoutMuted) {
        // Most keypresses are echoed as a single character. Don't print them.
        return;
      }
      return original.call(this, stringToWrite);
    };

    // Print the prompt ourselves while output is not muted, then ask with an empty query.
    // This avoids hiding the prompt while still hiding user input.
    rl.output.write(prompt);
    rlAny.stdoutMuted = true;

    rl.question('', (answer) => {
      rlAny.stdoutMuted = false;
      rlAny._writeToOutput = original;
      rl.output.write('\n');
      resolve(answer);
    });
  });
}

async function ensureEnvLocal({ force }) {
  if (!(await fileExists(ENV_EXAMPLE))) {
    throw new Error('Missing .env.example in repo root.');
  }

  const hasLocal = await fileExists(ENV_LOCAL);
  if (hasLocal && !force) {
    return { created: false };
  }

  const example = await fs.readFile(ENV_EXAMPLE, 'utf8');
  await fs.writeFile(ENV_LOCAL, example, 'utf8');
  return { created: true };
}

async function syncEnv() {
  if (!(await fileExists(ENV_LOCAL))) {
    throw new Error('Cannot sync: .env.local does not exist.');
  }

  const local = await fs.readFile(ENV_LOCAL, 'utf8');
  await fs.writeFile(ENV_DOCKER, local, 'utf8');
}

function parseArgs(argv) {
  const args = {
    help: false,
    init: false,
    sync: false,
    force: false,
    list: false,
    interactive: false,
    set: [],
    unset: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--init') args.init = true;
    else if (a === '--sync') args.sync = true;
    else if (a === '--force') args.force = true;
    else if (a === '--list') args.list = true;
    else if (a === '--interactive') args.interactive = true;
    else if (a === '--set') {
      const next = argv[++i];
      if (!next || !next.includes('=')) throw new Error('--set expects KEY=VALUE');
      args.set.push(next);
    } else if (a.startsWith('--set=')) {
      const v = a.slice('--set='.length);
      if (!v.includes('=')) throw new Error('--set expects KEY=VALUE');
      args.set.push(v);
    } else if (a === '--unset') {
      const next = argv[++i];
      if (!next) throw new Error('--unset expects KEY');
      args.unset.push(next);
    } else if (a.startsWith('--unset=')) {
      args.unset.push(a.slice('--unset='.length));
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  return args;
}

async function listKeys() {
  const example = await fs.readFile(ENV_EXAMPLE, 'utf8');
  const keys = extractKeysFromEnvExample(example);
  keys.sort((a, b) => a.localeCompare(b));
  process.stdout.write(keys.join('\n') + '\n');
}

async function applySetUnset({ setPairs, unsetKeys }) {
  const parsed = await readEnvFile(ENV_LOCAL);

  const changed = new Set();

  for (const k of unsetKeys) {
    unsetEnvKey(parsed, k);
    changed.add(k);
  }

  for (const pair of setPairs) {
    const idx = pair.indexOf('=');
    const key = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    if (!key) throw new Error(`Invalid --set: ${pair}`);
    setEnvKey(parsed, key, value);
    changed.add(key);
  }

  await writeEnvFile(ENV_LOCAL, parsed);

  return { changed: Array.from(changed) };
}

async function interactiveWizard() {
  if (!(await fileExists(ENV_EXAMPLE))) {
    throw new Error('Missing .env.example in repo root.');
  }

  const example = await fs.readFile(ENV_EXAMPLE, 'utf8');
  const knownKeys = extractKeysFromEnvExample(example);
  const knownSet = new Set(knownKeys);

  const rl = createInterface();

  try {
    if (!(await fileExists(ENV_LOCAL))) {
      const ans = (await question(rl, 'Create .env.local from .env.example? (y/N) ')).trim().toLowerCase();
      if (ans === 'y' || ans === 'yes') {
        await ensureEnvLocal({ force: false });
        process.stdout.write('Created .env.local\n');
      } else {
        process.stdout.write('Skipping .env.local creation. Exiting.\n');
        return;
      }
    }

    const syncAns = (await question(rl, 'Sync .env (for Docker Compose) from .env.local? (y/N) '))
      .trim()
      .toLowerCase();
    if (syncAns === 'y' || syncAns === 'yes') {
      await syncEnv();
      process.stdout.write('Synced .env from .env.local\n');
    }

    const parsed = await readEnvFile(ENV_LOCAL);
    const updatedKeys = [];

    while (true) {
      const pick = (await question(
        rl,
        'Enter comma-separated env keys to set (blank to finish, "list" to show all): ',
      ))
        .trim()
        .toLowerCase();

      if (!pick) break;

      if (pick === 'list') {
        const sorted = [...knownKeys].sort((a, b) => a.localeCompare(b));
        process.stdout.write(sorted.join('\n') + '\n');
        continue;
      }

      const keys = pick
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => x.toUpperCase());

      for (const key of keys) {
        if (!knownSet.has(key)) {
          const cont = (await question(rl, `Key "${key}" is not in .env.example. Set anyway? (y/N) `))
            .trim()
            .toLowerCase();
          if (!(cont === 'y' || cont === 'yes')) continue;
        }

        const hasValue = parsed.valueByKey.has(key) && String(parsed.valueByKey.get(key) ?? '').trim() !== '';
        const hint = hasValue ? '(currently set)' : '(currently empty)';

        const prompt = isSensitiveKey(key)
          ? `Value for ${key} ${hint} (input hidden, blank keeps current): `
          : `Value for ${key} ${hint} (blank keeps current): `;

        const valueRaw = isSensitiveKey(key) ? await questionHidden(rl, prompt) : await question(rl, prompt);
        const value = String(valueRaw ?? '').trim();

        if (!value) continue;

        setEnvKey(parsed, key, value);
        updatedKeys.push(key);
      }

      await writeEnvFile(ENV_LOCAL, parsed);
    }

    if (updatedKeys.length > 0) {
      const unique = Array.from(new Set(updatedKeys));
      process.stdout.write(`Updated keys: ${unique.join(', ')}\n`);
    } else {
      process.stdout.write('No changes made.\n');
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(usage() + '\n');
    return;
  }

  if (args.list) {
    await listKeys();
    return;
  }

  const hasActions = args.init || args.sync || args.set.length > 0 || args.unset.length > 0;
  const shouldInteractive = args.interactive || !hasActions;

  if (args.init) {
    const result = await ensureEnvLocal({ force: args.force });
    process.stdout.write(result.created ? 'Created .env.local\n' : '.env.local already exists (use --force to overwrite)\n');
  }

  if (args.set.length > 0 || args.unset.length > 0) {
    if (!(await fileExists(ENV_LOCAL))) {
      throw new Error('.env.local is missing. Run with --init first or use interactive mode.');
    }

    const { changed } = await applySetUnset({ setPairs: args.set, unsetKeys: args.unset });
    if (changed.length > 0) {
      process.stdout.write(`Updated keys in .env.local: ${changed.join(', ')}\n`);
    }
  }

  if (args.sync) {
    await syncEnv();
    process.stdout.write('Synced .env from .env.local\n');
  }

  if (shouldInteractive) {
    await interactiveWizard();
  }
}

await main().catch((err) => {
  process.stderr.write(`Error: ${err?.message || String(err)}\n`);
  process.stderr.write(usage() + '\n');
  process.exitCode = 1;
});

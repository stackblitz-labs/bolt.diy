#!/usr/bin/env node
/**
 * Clone Starter Templates
 *
 * Downloads and installs starter restaurant templates from remote repositories
 * or copies from local boilerplates into the templates/ directory.
 *
 * Usage:
 *   pnpm templates:clone [--template=<template-id>] [--source=<url|path>] [--force]
 *
 * Options:
 *   --template=<id>  Clone only the specified template (default: all from registry)
 *   --source=<path>  Clone from custom source URL or local path
 *   --force          Overwrite existing template directories
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface CloneOptions {
  template?: string;
  source?: string;
  force: boolean;
}

const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

// Default template sources (can be GitHub repos, local paths, or template IDs)
const DEFAULT_TEMPLATES = [
  {
    id: 'restaurant-classic',
    source: 'TODO: Add template source URL or path',
  },
  {
    id: 'bistro-elegant',
    source: 'TODO: Add template source URL or path',
  },
  {
    id: 'taqueria-modern',
    source: 'TODO: Add template source URL or path',
  },
];

async function parseArgs(): Promise<CloneOptions> {
  const args = process.argv.slice(2);
  return {
    template: args.find(arg => arg.startsWith('--template='))?.split('=')[1],
    source: args.find(arg => arg.startsWith('--source='))?.split('=')[1],
    force: args.includes('--force'),
  };
}

async function cloneTemplate(id: string, source: string, force: boolean): Promise<void> {
  const targetDir = path.join(TEMPLATES_DIR, id);

  // Check if template already exists
  try {
    await fs.access(targetDir);
    if (!force) {
      console.log(`⏭️  Skipping ${id} (already exists, use --force to overwrite)`);
      return;
    }
    // Remove existing directory if force is enabled
    await fs.rm(targetDir, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist, proceed with clone
  }

  console.log(`📥 Cloning ${id} from ${source}...`);

  // TODO: Implement actual cloning logic
  // 1. Detect source type (git URL, local path, npm package, etc.)
  // 2. Clone/copy template to templates/<id>/
  // 3. Run any post-clone setup (npm install, build, etc.)
  // 4. Validate template structure against schema
  // 5. Update registry.json with new template metadata

  console.log(`   ⚠️  TODO: Implement clone logic for ${id}`);

  // Placeholder: Create empty directory
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(
    path.join(targetDir, 'README.md'),
    `# ${id}\n\nTemplate placeholder - implementation pending.`,
    'utf-8'
  );

  console.log(`   ✓ Created placeholder at ${targetDir}`);
}

async function main() {
  const options = await parseArgs();

  console.log('📦 Cloning starter templates...');
  console.log(`Target: ${options.template || 'all templates'}`);
  console.log(`Force: ${options.force}\n`);

  // Ensure templates directory exists
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });

  // Determine which templates to clone
  const templatesToClone = options.template
    ? DEFAULT_TEMPLATES.filter(t => t.id === options.template)
    : DEFAULT_TEMPLATES;

  if (templatesToClone.length === 0) {
    console.error(`❌ Template "${options.template}" not found in default templates`);
    process.exit(1);
  }

  // Clone each template
  for (const template of templatesToClone) {
    const source = options.source || template.source;
    await cloneTemplate(template.id, source, options.force);
  }

  console.log('\n✓ Template cloning complete');
  console.log('  Next steps:');
  console.log('    1. Populate template content and assets');
  console.log('    2. Run `pnpm templates:seed` to update registry');
  console.log('    3. Validate templates against schema');
}

main().catch((error) => {
  console.error('❌ Cloning failed:', error.message);
  process.exit(1);
});

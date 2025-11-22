#!/usr/bin/env node
/**
 * Seed Template Registry
 *
 * Populates templates/registry.json with metadata for all available restaurant templates.
 * Can be extended to validate template schemas and download remote template assets.
 *
 * Usage:
 *   pnpm templates:seed [--template=<template-id>] [--validate] [--force]
 *
 * Options:
 *   --template=<id>  Seed only the specified template (default: all)
 *   --validate       Run schema validation after seeding
 *   --force          Overwrite existing registry entries
 */

import fs from 'fs/promises';
import path from 'path';

interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  tone: string[];
  requiredSections: string[];
  preview_url?: string;
  created_at: string;
}

interface TemplateRegistry {
  version: string;
  templates: TemplateMetadata[];
}

const REGISTRY_PATH = path.join(process.cwd(), 'templates', 'registry.json');
const TEMPLATES_DIR = path.join(process.cwd(), 'templates');

async function main() {
  const args = process.argv.slice(2);
  const targetTemplate = args.find(arg => arg.startsWith('--template='))?.split('=')[1];
  const validate = args.includes('--validate');
  const force = args.includes('--force');

  console.log('🌱 Seeding template registry...');
  console.log(`Target: ${targetTemplate || 'all templates'}`);
  console.log(`Validate: ${validate}`);
  console.log(`Force: ${force}\n`);

  // TODO: Implement template discovery and registration
  // 1. Scan templates/ directory for valid template folders
  // 2. Read template.json or package.json from each template
  // 3. Validate template structure and required files
  // 4. Build registry.json with metadata
  // 5. Optionally validate against Zod schema from app/lib/modules/templates/schema.ts

  console.log('⚠️  TODO: Implement template seeding logic');
  console.log('    - Scan templates directory');
  console.log('    - Extract template metadata');
  console.log('    - Validate template structure');
  console.log('    - Generate/update registry.json');

  // Placeholder: Create empty registry if it doesn't exist
  try {
    await fs.access(REGISTRY_PATH);
    if (!force) {
      console.log(`✓ Registry exists at ${REGISTRY_PATH}`);
      console.log('  Use --force to overwrite');
      return;
    }
  } catch {
    // Registry doesn't exist, create it
  }

  const registry: TemplateRegistry = {
    version: '1.0.0',
    templates: [],
  };

  await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');

  console.log(`\n✓ Created empty registry at ${REGISTRY_PATH}`);
  console.log('  Ready for template metadata population');
}

main().catch((error) => {
  console.error('❌ Seeding failed:', error.message);
  process.exit(1);
});

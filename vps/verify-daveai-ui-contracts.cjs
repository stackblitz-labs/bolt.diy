#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const htmlPath = process.argv[2];
if (!htmlPath) {
  throw new Error('usage: node verify-daveai-ui-contracts.cjs <daveai-ui-v6.html>');
}
const html = fs.readFileSync(htmlPath, 'utf8');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const idCounts = new Map();
for (const id of ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
const duplicateIds = [...idCounts].filter(([, count]) => count > 1);

const declaredFunctions = new Set([
  ...[...html.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]),
  ...[...html.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)].map(match => match[1]),
  ...[...html.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)].map(match => match[1]),
]);

const handlerAttributes = [...html.matchAll(/\bon(?:click|change|input|keydown|keyup|contextmenu|mousedown|mouseup)="([^"]*)"/gi)];
const ignoredCalls = new Set([
  'alert', 'confirm', 'prompt', 'fetch', 'open', 'setTimeout', 'clearTimeout',
  'parseInt', 'parseFloat', 'String', 'Number', 'Boolean', 'Date', 'Array',
  'Object', 'JSON', 'Math', 'encodeURIComponent', 'decodeURIComponent',
]);
const handlerCalls = new Set();
for (const match of handlerAttributes) {
  for (const call of match[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!ignoredCalls.has(call[1]) && call[1] !== 'if') handlerCalls.add(call[1]);
  }
}
const missingHandlerFunctions = [...handlerCalls].filter(name => !declaredFunctions.has(name)).sort();

const referencedIds = new Set([
  ...[...html.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]),
  ...[...html.matchAll(/querySelector\(\s*['"]#([A-Za-z][\w:-]*)['"]\s*\)/g)].map(match => match[1]),
]);
const createdIds = new Set([
  ...[...html.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].map(match => match[1]),
  ...[...html.matchAll(/setAttribute\(\s*['"]id['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]),
]);
const referencedIdsWithoutStaticNodes = [...referencedIds].filter(id => !idCounts.has(id));
const dynamicallyCreatedIds = referencedIdsWithoutStaticNodes.filter(id => createdIds.has(id)).sort();
const missingStaticIds = referencedIdsWithoutStaticNodes.filter(id => !createdIds.has(id)).sort();

const unnamedButtons = [];
for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
  const attrs = match[1];
  const body = match[2];
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[A-Za-z0-9#]+;/g, ' ')
    .replace(/\$\{[^}]+\}/g, ' dynamic ')
    .replace(/\s+/g, ' ')
    .trim();
  const named = /\b(?:aria-label|title)="[^"]+"/i.test(attrs) || text.length > 0;
  if (!named) {
    const line = html.slice(0, match.index).split('\n').length;
    unnamedButtons.push({ line, attrs: attrs.trim().replace(/\s+/g, ' ').slice(0, 160) });
  }
}

const nonKeyboardClickTargets = [];
for (const match of html.matchAll(/<(div|span)\b([^>]*\bonclick="[^"]+"[^>]*)>/gi)) {
  const attrs = match[2];
  const role = attrs.match(/\brole="([^"]+)"/i)?.[1] || '';
  const hasTabIndex = /\btabindex="-?\d+"/i.test(attrs);
  const hasKeyboardHandler = /\bonkey(?:down|up)="[^"]+"/i.test(attrs);
  const isBackdropDismissal = role === 'dialog'
    && /event\.target(?:\.id)?\s*={2,3}\s*(?:this|['"][^'"]+['"])/i.test(attrs);
  if (!isBackdropDismissal && (!role || !hasTabIndex || !hasKeyboardHandler)) {
    const line = html.slice(0, match.index).split('\n').length;
    nonKeyboardClickTargets.push({
      line,
      tag: match[1],
      missing: [
        !role ? 'role' : null,
        !hasTabIndex ? 'tabindex' : null,
        !hasKeyboardHandler ? 'keyboard-handler' : null,
      ].filter(Boolean),
      attrs: attrs.trim().replace(/\s+/g, ' ').slice(0, 160),
    });
  }
}

const scriptBlocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
for (const [index, block] of scriptBlocks.entries()) {
  try {
    new Function(block);
  } catch (error) {
    throw new Error(`inline script ${index} failed to compile: ${error.message}`);
  }
}

const result = {
  inlineScriptsCompiled: scriptBlocks.length,
  staticIds: ids.length,
  duplicateIds,
  handlerAttributes: handlerAttributes.length,
  missingHandlerFunctions,
  referencedStaticIds: referencedIds.size,
  dynamicallyCreatedIds,
  missingStaticIds,
  unnamedButtons,
  nonKeyboardClickTargets,
};

console.log(JSON.stringify(result, null, 2));
if (
  duplicateIds.length
  || missingHandlerFunctions.length
  || missingStaticIds.length
  || unnamedButtons.length
  || nonKeyboardClickTargets.length
) {
  process.exitCode = 1;
}

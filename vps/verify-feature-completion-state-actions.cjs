#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const htmlPath = process.argv[2];
if (!htmlPath) {
  throw new Error('usage: node verify-feature-completion-state-actions.js <daveai-ui-v6.html>');
}
const html = fs.readFileSync(htmlPath, 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing source marker: ${startMarker}`);
  assert.ok(end > start, `missing source marker: ${endMarker}`);
  return html.slice(start, end);
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

const memoryKey = 'daveai_memory';
const backupKey = 'daveai_memory_backup';
const undoButton = { disabled: true };
const memoryEvents = [];
const memoryContext = vm.createContext({
  console,
  JSON,
  Date,
  confirm: () => true,
  localStorage: storage({ [memoryKey]: '{"facts":["proof"]}' }),
  document: { getElementById: id => id === 'stg-memory-undo' ? undoButton : null },
  addRichActivity: event => memoryEvents.push(event),
  _MEMORY_KEY: memoryKey,
  _MEMORY_BACKUP_KEY: backupKey,
});
vm.runInContext(
  sourceBetween('function _clearMemory()', 'function _exportMemory()'),
  memoryContext,
);
memoryContext._clearMemory();
assert.equal(memoryContext.localStorage.getItem(memoryKey), null);
assert.ok(memoryContext.localStorage.getItem(backupKey));
assert.equal(undoButton.disabled, false);
memoryContext._undoClearMemory();
assert.equal(memoryContext.localStorage.getItem(memoryKey), '{"facts":["proof"]}');
assert.equal(memoryContext.localStorage.getItem(backupKey), null);
assert.equal(undoButton.disabled, true);
assert.match(memoryEvents.at(-1).msg, /restored/i);

let presetSaves = 0;
let presetRenders = 0;
const presetEvents = [];
const presetContext = vm.createContext({
  console,
  confirm: () => true,
  _vsState: { userPresets: [{ name: 'Disposable proof preset' }] },
  vsSave: () => { presetSaves += 1; },
  _vsRenderPresets: () => { presetRenders += 1; },
  addRichActivity: event => presetEvents.push(event),
});
vm.runInContext(
  sourceBetween('function vsDeleteUserPreset(idx)', '// ── Save / Export / Import / Share'),
  presetContext,
);
presetContext.vsDeleteUserPreset(0);
assert.equal(presetContext._vsState.userPresets.length, 0);
assert.equal(presetSaves, 1);
assert.equal(presetRenders, 1);
assert.match(presetEvents.at(-1).msg, /Deleted voice preset/);

let resetSaves = 0;
let resetPopulates = 0;
const resetEvents = [];
const resetContext = vm.createContext({
  console,
  confirm: () => true,
  _vsState: { voice: 'mutated' },
  _vsDefaults: () => ({ voice: 'default-proof' }),
  vsSave: () => { resetSaves += 1; },
  vsPopulateAll: () => { resetPopulates += 1; },
  addRichActivity: event => resetEvents.push(event),
});
vm.runInContext(
  sourceBetween('function vsResetDefaults()', '// ── Moshi Instant Voice'),
  resetContext,
);
resetContext.vsResetDefaults();
assert.equal(resetContext._vsState.voice, 'default-proof');
assert.equal(resetSaves, 1);
assert.equal(resetPopulates, 1);
assert.match(resetEvents.at(-1).msg, /reset to defaults/);

let tokenClears = 0;
let currentUser = { email: 'proof@example.test' };
const authOverlay = {
  classList: { remove: name => assert.equal(name, 'hid') },
  style: {},
};
const authStorage = storage({ daveai_user: JSON.stringify(currentUser) });
const signOutContext = vm.createContext({
  console,
  clearToken: () => { tokenClears += 1; },
  localStorage: authStorage,
  _setCurrentUser: value => { currentUser = value; },
  document: { getElementById: id => id === 'am-ov' ? authOverlay : null },
});
vm.runInContext(
  sourceBetween('function showAuth()', '// ══ WORKSPACE LAYOUTS'),
  signOutContext,
);
signOutContext.showAuth();
assert.equal(tokenClears, 1);
assert.equal(authStorage.getItem('daveai_user'), null);
assert.equal(currentUser, null);
assert.equal(authOverlay.style.opacity, 1);
assert.equal(authOverlay.style.pointerEvents, '');

console.log('memory_clear=pass memory_undo=pass preset_delete=pass voice_reset=pass sign_out=pass');

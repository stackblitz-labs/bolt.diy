#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.error('Missing dependency: playwright. Install it or run with the Codex bundled NODE_PATH.');
  console.error(error.message);
  process.exit(1);
}

const base = process.env.DAVEAI_BASE_URL || 'https://daveai.tech';
const proofDir = path.resolve(process.env.DAVEAI_PROOF_DIR || path.join('proofs', `daveai-prod-e2e-${Date.now()}`));
const authEmail = process.env.DAVEAI_E2E_EMAIL || '';
const authPassword = process.env.DAVEAI_E2E_PASSWORD || '';

fs.mkdirSync(proofDir, { recursive: true });

const results = [];

function record(name, status, details = {}) {
  results.push({ name, status, ...details });
  const label = status === 'passed' ? 'PASS' : status === 'skipped' ? 'SKIP' : 'FAIL';
  console.log(`${label} ${name}`);
}

async function newTrackedPage(browser, name) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 768 }, ignoreHTTPSErrors: true });
  const trace = { badResponses: [], requestFailures: [], pageErrors: [], consoleMessages: [] };
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) trace.badResponses.push({ status, url: response.url() });
  });
  page.on('requestfailed', (request) => {
    trace.requestFailures.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      failure: request.failure()?.errorText || '',
    });
  });
  page.on('pageerror', (error) => trace.pageErrors.push(String(error.message || error)));
  page.on('console', (message) => {
    const text = message.text();
    if (/Failed to load resource|error|exception|uncaught|not found|502|404|401|ERR_FAILED/i.test(text)) {
      trace.consoleMessages.push({ type: message.type(), text, location: message.location() });
    }
  });
  page._daveTrace = trace;
  page._proofName = name;
  return page;
}

function assertCleanTrace(trace, allow = () => false) {
  const badResponses = trace.badResponses.filter((item) => !allow(item));
  const requestFailures = trace.requestFailures.filter((item) => {
    // Chromium reports these when a page is reloaded, closed, or an iframe/game switches targets.
    // They are not the same as a server/client failure such as 404, 502, CORS, DNS, or TLS.
    if (/net::ERR_ABORTED/i.test(item.failure || '')) return false;
    return !allow(item);
  });
  const consoleMessages = trace.consoleMessages.filter((item) => !/favicon|sandbox/i.test(item.text) && !allow(item));
  return {
    clean: badResponses.length === 0 && requestFailures.length === 0 && trace.pageErrors.length === 0 && consoleMessages.length === 0,
    badResponses,
    requestFailures,
    pageErrors: trace.pageErrors,
    consoleMessages,
  };
}

async function screenshot(page, name) {
  const file = path.join(proofDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function saveJson(name, payload) {
  const file = path.join(proofDir, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

async function testHealth() {
  const urls = [
    `${base}/api/health`,
    'https://brain.daveai.tech/health',
    'https://voice.daveai.tech/health',
    'https://api.daveai.tech/health',
    'https://iptv.daveai.tech/api/provider-vault/providers',
  ];
  const checks = [];
  for (const url of urls) {
    const response = await fetch(url, { redirect: 'manual' });
    checks.push({ url, status: response.status, contentType: response.headers.get('content-type'), body: (await response.text()).slice(0, 300) });
  }
  await saveJson('health-endpoints', checks);
  const failed = checks.filter((check) => check.status !== 200);
  record('health endpoints', failed.length ? 'failed' : 'passed', { checks, failed });
}

async function testUnauthChatGate(browser) {
  const page = await newTrackedPage(browser, 'chat-auth-gate');
  await page.goto(`${base}/?intro=off&e2e=auth-gate-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate(() => {
    localStorage.removeItem('daveai_token');
    localStorage.removeItem('daveai_token_ts');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    authVisible: Boolean(document.querySelector('#auth-modal, .auth-modal, [data-auth-modal]')) || /sign in|create one|forgot password/i.test(document.body.innerText),
    typing: /thinking/i.test(document.body.innerText),
    bodyText: document.body.innerText.slice(0, 1000),
  }));
  const image = await screenshot(page, 'chat-auth-gate');
  const trace = assertCleanTrace(page._daveTrace, (item) => /\/api\/health/.test(item.url || ''));
  await saveJson('chat-auth-gate', { state, trace, image });
  await page.close();
  record('chat auth gate', state.authVisible && trace.clean ? 'passed' : 'failed', { state, trace, image });
}

async function testAuthenticatedChat(browser) {
  if (!authEmail || !authPassword) {
    record('authenticated chat reply', 'skipped', { reason: 'Set DAVEAI_E2E_EMAIL and DAVEAI_E2E_PASSWORD to run this proof.' });
    return;
  }
  const page = await newTrackedPage(browser, 'authenticated-chat');
  await page.goto(`${base}/?intro=off&e2e=chat-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.fill('input[type="email"], input[name="email"]', authEmail);
  await page.fill('input[type="password"], input[name="password"]', authPassword);
  await page.getByRole('button', { name: /sign in|log in|login/i }).first().click();
  await page.waitForTimeout(3000);
  const input = page.locator('#mc-input, textarea[placeholder*="Describe"], input[placeholder*="Describe"]').first();
  await input.fill('Say exactly: production chat e2e ok');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /production chat e2e ok|Ready/i.test(document.body.innerText), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const state = await page.evaluate(() => ({ bodyText: document.body.innerText.slice(-2500), ready: /Ready/i.test(document.body.innerText) }));
  const image = await screenshot(page, 'authenticated-chat');
  const trace = assertCleanTrace(page._daveTrace);
  await saveJson('authenticated-chat', { state, trace, image });
  await page.close();
  record('authenticated chat reply', state.ready && trace.clean ? 'passed' : 'failed', { state, trace, image });
}

async function testCarousel(browser) {
  const page = await newTrackedPage(browser, 'carousel-launch');
  await page.goto(`${base}/?intro=off&e2e=carousel-${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(4000);
  const launches = [];
  for (let index = 0; index < 3; index += 1) {
    await page.evaluate((i) => {
      if (typeof window.launchCarouselGame === 'function') window.launchCarouselGame(i);
      else document.querySelectorAll('[data-game-action="launch"], .game-card')[i]?.click();
    }, index);
    await page.waitForTimeout(3500);
    launches.push(await page.evaluate(() => {
      const iframe = document.querySelector('iframe#game-frame, iframe[src*="/games/"]');
      return { iframeSrc: iframe?.src || '', bodyText: document.body.innerText.slice(0, 800) };
    }));
    await screenshot(page, `carousel-launch-${index}`);
  }
  const trace = assertCleanTrace(page._daveTrace);
  await saveJson('carousel-launch', { launches, trace });
  await page.close();
  record('carousel launch', launches.every((item) => /\/games\//.test(item.iframeSrc)) && trace.clean ? 'passed' : 'failed', { launches, trace });
}

async function testCoreGames(browser) {
  const games = [
    { id: 'td2', url: `${base}/games/daveai-td2/index.html`, expect: /DaveAI TD2/i },
    { id: 'asteroids', url: `${base}/games/asteroids/index.html`, expect: /Asteroids/i },
    { id: 'siege', url: `${base}/games/daves-siege-td/index.html`, expect: /Siege TD|Dave's Siege/i },
  ];
  const gameResults = [];
  for (const game of games) {
    const page = await newTrackedPage(browser, `game-${game.id}`);
    await page.goto(`${game.url}?e2e=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(9000);
    const state = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
      canvasCount: document.querySelectorAll('canvas').length,
      buttonText: [...document.querySelectorAll('button')].map((button) => button.innerText || button.getAttribute('aria-label') || '').filter(Boolean).slice(0, 20),
      bodyText: document.body.innerText.slice(0, 1200),
    }));
    const image = await screenshot(page, `game-${game.id}`);
    const trace = assertCleanTrace(page._daveTrace, (item) => /WebGL|AudioContext|Autoplay/i.test(item.text || ''));
    const passed = trace.clean && (state.canvasCount > 0 || game.expect.test(`${state.title}\n${state.h1}\n${state.bodyText}`));
    gameResults.push({ game, state, trace, image, passed });
    await page.close();
  }
  await saveJson('core-games', gameResults);
  record('TD2/Asteroids/Siege runtime checks', gameResults.every((result) => result.passed) ? 'passed' : 'failed', { gameResults });
}

async function testNonGamePages(browser) {
  const pages = [
    { id: 'studio', url: `${base}/studio/index.html` },
    { id: 'web-pages', url: `${base}/web-pages.html` },
    { id: 'windsurf', url: `${base}/windsurf.html` },
    { id: 'voice', url: 'https://voice.daveai.tech/' },
    { id: 'voice-landing', url: `${base}/voice-landing.html` },
    { id: 'streamhub', url: 'https://iptv.daveai.tech/' },
  ];
  const pageResults = [];
  for (const item of pages) {
    const page = await newTrackedPage(browser, `page-${item.id}`);
    await page.goto(`${item.url}${item.url.includes('?') ? '&' : '?'}e2e=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    const state = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
      authGate: Boolean(document.querySelector('#windsurf-auth-gate')),
      videoCount: document.querySelectorAll('video').length,
      bodyText: document.body.innerText.slice(0, 1000),
    }));
    const image = await screenshot(page, `page-${item.id}`);
    const trace = assertCleanTrace(page._daveTrace);
    pageResults.push({ item, state, trace, image, passed: trace.clean });
    await page.close();
  }
  await saveJson('non-game-pages', pageResults);
  record('non-game pages', pageResults.every((result) => result.passed) ? 'passed' : 'failed', { pageResults });
  const streamhub = pageResults.find((result) => result.item.id === 'streamhub');
  record('StreamHub no-error render', streamhub && streamhub.passed && streamhub.state.videoCount > 0 ? 'passed' : 'failed', { streamhub });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    await testHealth();
    await testUnauthChatGate(browser);
    await testAuthenticatedChat(browser);
    await testCarousel(browser);
    await testCoreGames(browser);
    await testNonGamePages(browser);
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    base,
    proofDir,
    results,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };
  await saveJson('summary', summary);
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.failed === 0 ? 0 : 2);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

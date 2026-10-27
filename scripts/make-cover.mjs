// Renders scripts/cover/index.html to docs/cover.png (or the path given as argument).
// Uses the installed Chrome, or the Chromium at COVER_BROWSER.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.cwd(), process.argv[2] ?? resolve(root, 'docs/cover.png'));

async function launchBrowser() {
  if (process.env.COVER_BROWSER) return chromium.launch({ executablePath: process.env.COVER_BROWSER });
  try {
    return await chromium.launch({ channel: 'chrome' });
  } catch {
    return chromium.launch();
  }
}

const server = await createServer({ root, logLevel: 'error', server: { port: 0 } });
await server.listen();
let browser;
try {
  browser = await launchBrowser().catch((err) => {
    throw new Error(
      'No browser found. Install Google Chrome, run "npx playwright install chromium", ' +
        `or set COVER_BROWSER to a Chromium executable.\n${err.message}`,
    );
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 800 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  await page.goto(new URL('scripts/cover/index.html', server.resolvedUrls.local[0]).href);
  await page.waitForSelector('body[data-ready]', { timeout: 15000 }).catch(() => {
    throw errors[0] ?? new Error('The cover page did not finish rendering.');
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  console.log(`Cover written to ${out}`);
} finally {
  await browser?.close();
  await server.close();
}

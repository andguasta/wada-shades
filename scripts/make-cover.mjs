// Renders scripts/cover/index.html and saves it as the README cover.
//
//   npm run cover                 writes docs/cover.png
//   npm run cover -- out.png      writes another path
//
// Uses your installed Google Chrome. To use another Chromium build, set
// COVER_BROWSER to its executable path. Edit the combinations and shade
// settings at the top of scripts/cover/cover.ts.
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
    // No Chrome installed: fall back to a Playwright-managed Chromium, if any.
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

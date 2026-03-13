import { chromium } from 'playwright';

const URL = process.env.URL ?? 'http://localhost:5174/';

function now() {
  return new Date().toISOString();
}

function fmtConsole(msg) {
  const type = msg.type();
  const text = msg.text();
  const loc = msg.location?.();
  const locStr = loc?.url ? ` @ ${loc.url}:${loc.lineNumber}:${loc.columnNumber}` : '';
  return `[${now()}] [console.${type}] ${text}${locStr}`;
}

function fmtRequestFailure(req) {
  const failure = req.failure?.();
  const failureText = failure?.errorText ?? 'unknown failure';
  return `[${now()}] [requestfailed] ${req.method()} ${req.url()} -> ${failureText}`;
}

function fmtResponseError(res) {
  const req = res.request();
  return `[${now()}] [response] ${res.status()} ${res.statusText()} ${req.method()} ${req.url()}`;
}

const events = {
  console: [],
  pageerror: [],
  requestfailed: [],
  badstatus: [],
};

const browser = await chromium.launch({
  headless: true,
});

const context = await browser.newContext();
const page = await context.newPage();

page.on('console', (msg) => {
  events.console.push(fmtConsole(msg));
});

page.on('pageerror', (err) => {
  events.pageerror.push(`[${now()}] [pageerror] ${err?.stack || String(err)}`);
});

page.on('requestfailed', (req) => {
  events.requestfailed.push(fmtRequestFailure(req));
});

page.on('response', (res) => {
  const status = res.status();
  if (status >= 400) events.badstatus.push(fmtResponseError(res));
});

let canvasFound = false;
let screenshotAfterLoad = null;
let screenshotAfterClick = null;
let searchStatusText = null;
let searchResultCount = null;

try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  const canvas = page.locator('canvas').first();
  canvasFound = await canvas.count().then((c) => c > 0);

  if (canvasFound) {
    await canvas.waitFor({ state: 'visible', timeout: 15000 });
    screenshotAfterLoad = 'playwright-screenshot-after-load.png';
    await page.screenshot({ path: screenshotAfterLoad, fullPage: true }).catch(() => {});
    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;

      // Drag to rotate.
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 120, cy + 30, { steps: 12 });
      await page.mouse.up();

      // Scroll to zoom (both directions).
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(250);
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(250);

      // Click to drop marker.
      await page.mouse.click(cx, cy);
      await page.waitForTimeout(600);
      screenshotAfterClick = 'playwright-screenshot-after-click.png';
      await page.screenshot({ path: screenshotAfterClick, fullPage: true }).catch(() => {});
    }
  }

  // Search "Hyderabad"
  const input = page.locator('#searchInput');
  const btn = page.locator('#searchBtn');
  if ((await input.count()) && (await btn.count())) {
    await input.fill('Hyderabad');
    await btn.click();
    await page.waitForTimeout(3500);
    searchStatusText = await page.locator('#searchStatus').textContent().catch(() => null);
    searchResultCount = await page.locator('#searchResults .resultItem').count().catch(() => null);
  }

  // Give any async logs a moment.
  await page.waitForTimeout(500);
} finally {
  await browser.close();
}

const summary = {
  url: URL,
  canvasFound,
  screenshotAfterLoad,
  screenshotAfterClick,
  searchStatusText,
  searchResultCount,
  consoleCount: events.console.length,
  pageErrorCount: events.pageerror.length,
  requestFailedCount: events.requestfailed.length,
  badStatusCount: events.badstatus.length,
};

// Print machine-readable summary, then details.
console.log(JSON.stringify({ summary, events }, null, 2));


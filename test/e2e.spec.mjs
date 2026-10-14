// End-to-end: npx playwright test
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const URL_ = pathToFileURL(resolve('index.html')).href;

function watchConsole(page) {
  const bad = [];
  page.on('console', m => { if (m.type() === 'error') bad.push(m.text()); });
  page.on('pageerror', e => bad.push(e.message));
  return bad;
}
async function boot(page) {
  await page.goto(URL_);
  await page.waitForFunction(() => window.__hj && (window.__hj.frames > 5 || window.__hj.fallback), null, { timeout: 20_000 });
  return page.evaluate(() => window.__hj.fallback);
}

test('loads the study with its chrome and no console errors or scroll', async ({ page }) => {
  const bad = watchConsole(page);
  const fb = await boot(page);
  await expect(page).toHaveTitle('Harbor Jelly');
  await expect(page.locator('#title h1')).toHaveText('Harbor Jelly.');
  await expect(page.locator('#title .eyebrow')).toHaveText('Material Studies');
  await expect(page.locator('#howto')).toContainText('How to play');
  if (fb) await expect(page.locator('#fallback')).toBeVisible();
  else await expect(page.locator('#pillText')).toHaveText('WebGPU · Live');
  const scroll = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth, ih: innerHeight, iw: innerWidth }));
  expect(scroll.h).toBeLessThanOrEqual(scroll.ih);
  expect(scroll.w).toBeLessThanOrEqual(scroll.iw);
  await page.mouse.wheel(0, 400);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.waitForTimeout(1500);
  expect(bad).toEqual([]);
});

test('ship controls, tally and interactions', async ({ page }) => {
  const bad = watchConsole(page);
  test.skip(await boot(page), 'WebGPU unavailable here; fallback covered separately');
  await expect(page.locator('#status')).toHaveText(/Unloading \d \/ 8/);
  // horn button and Space both sound the horn (and scatter gulls)
  await page.click('#hornBtn');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => __hj.S.hornCount)).toBeGreaterThanOrEqual(2);
  // feed the fish
  await page.click('#feedBtn');
  await expect(page.locator('#tFed')).toHaveText('1');
  // cast off early: cranes finish the box in hand, then the booms go up and the button greys out
  await page.click('#castBtn');
  await page.evaluate(() => __hj.ff(15));
  await expect(page.locator('#status')).toHaveText(/Booms up|Tug coming|Casting off/);
  await expect(page.locator('#castBtn')).toBeDisabled();
  // at sea it becomes "Call her in"
  await page.evaluate(() => __hj.ff(30));
  await expect(page.locator('#status')).toHaveText(/At sea \d+%|Coming in/);
  await expect(page.locator('#castBtn')).toHaveText('Call her in');
  await page.click('#castBtn');
  expect(await page.evaluate(() => __hj.S.hurry)).toBe(true);
  // flavour swatch
  await page.click('#flavours button[data-f="1"]');
  await expect(page.locator('#flavours button[data-f="1"]')).toHaveAttribute('aria-pressed', 'true');
  // sliders
  await page.locator('#tide').fill('8');
  await expect(page.locator('#tideO')).toHaveText('+8 cm');
  expect(await page.evaluate(() => __hj.S.tide)).toBeCloseTo(0.04);
  // drag across the water makes waves
  const before = await page.evaluate(() => { let e = 0; for (const v of __hj.S.W.h) e += v * v; return e; });
  await page.mouse.move(380, 560); await page.mouse.down();
  for (let i = 0; i < 12; i++) await page.mouse.move(380 + i * 18, 560 - i * 4);
  await page.mouse.up();
  const after = await page.evaluate(() => { let e = 0; for (const v of __hj.S.W.h) e += v * v; return e; });
  expect(after).toBeGreaterThan(before);
  // pause / sound / reset view
  await page.click('#pauseBtn'); await expect(page.locator('#pauseBtn')).toHaveText('Play');
  const t0 = await page.evaluate(() => __hj.S.t); await page.waitForTimeout(300);
  expect(await page.evaluate(() => __hj.S.t)).toBe(t0);
  await page.click('#pauseBtn');
  await page.click('#soundBtn'); await expect(page.locator('#soundBtn')).toHaveText('Sound off');
  await page.click('#viewBtn');
  await page.click('#resetBtn');
  await expect(page.locator('#tBoxes')).toHaveText('0');
  // the simulation stays cheap
  expect(await page.evaluate(() => __hj.S.simMs)).toBeLessThan(4);
  expect(await page.evaluate(() => __hj.errors)).toEqual([]);
  expect(bad).toEqual([]);
});

test('friendly fallback when WebGPU is missing', async ({ page }) => {
  const bad = watchConsole(page);
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined }); });
  await page.goto(URL_);
  await expect(page.locator('#fallback')).toBeVisible();
  await expect(page.locator('#fallback h3')).toHaveText('The jelly needs WebGPU.');
  await expect(page.locator('#pillText')).toHaveText('WebGPU · Unavailable');
  expect(bad).toEqual([]);
});

test('phone layout: collapsible bottom sheet', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const bad = watchConsole(page);
  await boot(page);
  const panel = page.locator('#panel');
  await expect(panel).toHaveClass(/collapsed/);
  await page.click('#sheetToggle');
  await expect(panel).not.toHaveClass(/collapsed/);
  const box = await panel.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(845);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(bad).toEqual([]);
  await page.close();
});

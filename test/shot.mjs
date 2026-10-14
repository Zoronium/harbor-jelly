// Dev helper: open the page in Chromium with WebGPU, print console output, save a screenshot.
// node test/shot.mjs [seconds] [out.png]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const secs = +(process.argv[2] || 4), out = process.argv[3] || 'shot.png';
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', m => console.log('[' + m.type() + ']', m.text()));
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(pathToFileURL(resolve('index.html')).href);
if (process.argv[4]) await page.evaluate(s => __hj.ff(s), +process.argv[4]);
await page.waitForTimeout(secs * 1000);
console.log(await page.evaluate(() => ({ ready: __hj.ready, fallback: __hj.fallback, frames: __hj.frames, errors: __hj.errors.slice(0, 5), status: document.getElementById('status').textContent })));
await page.screenshot({ path: out });
await browser.close();

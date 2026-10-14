import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  testMatch: /e2e\.spec\.mjs/,
  timeout: 60_000,
  use: {
    // installed Chrome has WebGPU; Playwright's bundled Chromium is fine too (falls back gracefully)
    channel: process.env.PW_CHANNEL || 'chrome',
    launchOptions: { args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu'] },
    viewport: { width: 1280, height: 800 },
  },
});

import { defineConfig } from '@playwright/test';

// Uses the Chrome already installed on the machine (GitHub's Ubuntu runners have it),
// so no browser download is needed.
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4180/',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4180 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4180/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});

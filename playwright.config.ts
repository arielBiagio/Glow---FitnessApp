import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const installedChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export default defineConfig({
  testDir: './e2e', timeout: 60000, workers: 1, fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'qa-artifacts/playwright-results.json' }]],
  use: { viewport: { width: 393, height: 852 }, timezoneId: 'UTC', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (existsSync(installedChrome) ? installedChrome : undefined) } },
  projects: [
    { name: 'local-production', testMatch: 'local.spec.ts', use: { baseURL: 'http://127.0.0.1:5181' } },
    { name: 'webkit-production', testMatch: 'local.spec.ts', use: { browserName: 'webkit', baseURL: 'http://127.0.0.1:5181', launchOptions: {} } },
    { name: 'cloud-mocked', testMatch: 'cloud.spec.ts', use: { baseURL: 'http://127.0.0.1:5180' } },
  ],
  webServer: [
    { command: 'npm run build -- --outDir dist-qa-local && npm run preview -- --outDir dist-qa-local --host 127.0.0.1 --port 5181 --strictPort', url: 'http://127.0.0.1:5181', reuseExistingServer: false,
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' } },
    { command: 'npm run build -- --outDir dist-qa-cloud && npm run preview -- --outDir dist-qa-cloud --host 127.0.0.1 --port 5180 --strictPort', url: 'http://127.0.0.1:5180', reuseExistingServer: false,
      env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test_only' } },
  ],
});

import { defineConfig } from '@playwright/test'

const url = 'http://127.0.0.1:4193/'
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: url,
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: process.env.CHROME_PATH },
  },
  webServer: {
    command: 'npm run preview -- --port 4193 --strictPort',
    url,
    reuseExistingServer: !process.env.CI,
  },
})

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
    launchOptions: {
      executablePath: process.env.CHROME_PATH,
      // Software WebGL so the 3D brain renders on machines without a GPU.
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run preview -- --port 4193 --strictPort',
    url,
    reuseExistingServer: !process.env.CI,
  },
})

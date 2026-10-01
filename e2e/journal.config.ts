import { defineConfig, devices } from '@playwright/test'

// Client integration tests use a static component harness and intercepted API responses.
// They never authenticate to or mutate the configured hotel database.
export default defineConfig({
  testDir: '.', testMatch: 'journal-client.spec.ts', fullyParallel: false, workers: 1,
  reporter: 'list', use: { screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
})

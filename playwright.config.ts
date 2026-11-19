import { defineConfig, devices } from "@playwright/test";

const basePath = process.env.VITE_BASE_PATH || "/";
const previewUrl = `http://127.0.0.1:4173${basePath}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 2,
  timeout: 60000,
  use: {
    baseURL: previewUrl,
    viewport: { width: 390, height: 844 },
    timezoneId: "America/St_Johns",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: process.env.CI ? undefined : "chrome",
      },
    },
    {
      name: "android-chromium",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        channel: process.env.CI ? undefined : "chrome",
      },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: `npm run preview -- --port 4173 --base ${basePath}`,
    url: previewUrl,
    reuseExistingServer: false,
    timeout: 30000,
  },
});

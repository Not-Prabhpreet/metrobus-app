import { defineConfig } from "@playwright/test";

const basePath = process.env.VITE_BASE_PATH || "/";
const previewUrl = `http://127.0.0.1:4173${basePath}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: previewUrl,
    channel: process.env.CI ? undefined : "chrome",
    viewport: { width: 390, height: 844 },
    timezoneId: "America/St_Johns",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run preview -- --port 4173 --base ${basePath}`,
    url: previewUrl,
    reuseExistingServer: false,
    timeout: 30000,
  },
});

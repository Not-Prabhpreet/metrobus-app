import { test, expect } from "@playwright/test";

test("assets, install manifest and offline cache stay inside the hosting path", async ({
  page,
}) => {
  const basePath = process.env.VITE_BASE_PATH || "/";
  const failures: string[] = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Find your stop" }),
  ).toBeVisible();
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .evaluate((element: HTMLLinkElement) => element.href);
  const response = await page.request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  for (const value of [manifest.id, manifest.start_url, manifest.scope]) {
    expect(new URL(value, manifestUrl).pathname).toBe(basePath);
  }
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestUrl);
    expect(url.pathname.startsWith(basePath)).toBe(true);
    expect((await page.request.get(url.href)).ok()).toBe(true);
  }
  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      scope: registration.scope,
      script: registration.active?.scriptURL,
    };
  });
  expect(new URL(worker.scope).pathname).toBe(basePath);
  expect(new URL(worker.script!).pathname).toBe(`${basePath}sw.js`);
  const requests = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const key of keys) {
      const cache = await caches.open(key);
      urls.push(...(await cache.keys()).map((request) => request.url));
    }
    return urls;
  });
  expect(requests.length).toBeGreaterThan(5);
  expect(
    requests.every((url) => new URL(url).pathname.startsWith(basePath)),
  ).toBe(true);
  expect(failures).toEqual([]);
});

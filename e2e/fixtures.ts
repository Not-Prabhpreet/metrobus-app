import { test as base, expect } from "@playwright/test";

// CI checks the map integration without bulk-requesting public OSM tiles.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("https://tile.openstreetmap.org/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
    );
    await use(page);
  },
});
export { expect };

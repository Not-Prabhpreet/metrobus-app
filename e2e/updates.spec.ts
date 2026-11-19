import { test, expect } from "./fixtures";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import type { AddressInfo } from "node:net";

test("new deploy replaces an open old build, clears old caches and stays usable offline", async ({
  page,
  context,
}) => {
  let version = 1;
  const scope = process.env.VITE_BASE_PATH || "/";
  const directory = resolve("dist");
  const html = readFileSync(resolve(directory, "index.html"), "utf8");
  const worker = readFileSync(resolve(directory, "sw.js"), "utf8");
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname;
    response.setHeader("Cache-Control", "public, max-age=600");
    if (path === scope + "sw.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(
        worker.replace(
          /const CACHE = CACHE_PREFIX \+ "[^"]+";/,
          `const CACHE = CACHE_PREFIX + "test-build-${version}";`,
        ),
      );
    } else if (path === scope || path === scope + "index.html") {
      response.setHeader("Content-Type", "text/html");
      response.end(
        html.replace("<body>", `<body data-test-release="${version}">`),
      );
    } else if (path === scope + "probe.txt") response.end("network " + version);
    else if (path === scope + "data/probe.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ version }));
    } else {
      const file = resolve(directory, path.slice(scope.length));
      if (!path.startsWith(scope) || !file.startsWith(directory + sep)) {
        response.statusCode = 404;
        response.end();
        return;
      }
      try {
        const types: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".json": "application/json",
          ".webmanifest": "application/manifest+json",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".woff": "font/woff",
          ".woff2": "font/woff2",
        };
        response.setHeader(
          "Content-Type",
          types[extname(file)] || "application/octet-stream",
        );
        response.end(readFileSync(file));
      } catch {
        response.statusCode = 404;
        response.end("missing");
      }
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    url = origin + scope;
  try {
    await page.goto(url + "#/saved");
    await page
      .getByRole("heading", { name: "Saved stops", exact: true })
      .waitFor();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await expect(page.locator("body")).toHaveAttribute(
      "data-test-release",
      "1",
    );
    await page.evaluate(async () => {
      const key = (await caches.keys()).find((name) =>
        name.endsWith("test-build-1"),
      )!;
      const cache = await caches.open(key);
      await cache.put(
        new URL("index.html", location.href).href,
        new Response("<h1>Stale cached HTML</h1>", {
          headers: { "Content-Type": "text/html" },
        }),
      );
      await cache.put(
        new URL("probe.txt", location.href).href,
        new Response("stale probe"),
      );
      await caches.open("another-app-cache");
      localStorage.setItem("metrobus-saved", JSON.stringify(["1000"]));
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Saved stops", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".saved-card")).toHaveCount(1);
    expect(
      await page.evaluate(() => fetch("./probe.txt").then((r) => r.text())),
    ).toBe("network 1");
    version = 2;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    // The real app stays open: no manual reload, cache clearing or tab closing.
    await expect(page.locator("body")).toHaveAttribute(
      "data-test-release",
      "2",
      { timeout: 20000 },
    );
    await expect(page).toHaveURL(url + "#/saved");
    await expect(page.locator(".saved-card")).toHaveCount(1);
    const keys = await page.evaluate(() => caches.keys());
    expect(keys.some((name) => name.endsWith("test-build-1"))).toBe(false);
    expect(keys.some((name) => name.endsWith("test-build-2"))).toBe(true);
    expect(keys).toContain("another-app-cache");
    expect(
      await page.evaluate(() =>
        fetch("./data/probe.json").then((r) => r.json()),
      ),
    ).toEqual({ version: 2 });
    version = 3;
    expect(
      await page.evaluate(() =>
        fetch("./data/probe.json").then((r) => r.json()),
      ),
    ).toEqual({ version: 2 });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).toHaveAttribute(
      "data-test-release",
      "2",
    );
    await expect(page.locator(".saved-card")).toHaveCount(1);
    expect(
      await page.evaluate(() =>
        fetch("./data/probe.json").then((r) => r.json()),
      ),
    ).toEqual({ version: 2 });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
});

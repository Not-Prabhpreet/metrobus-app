import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { activeServices, serviceInstant } from "../src/lib/time.mjs";

const data = JSON.parse(readFileSync("public/data/schedule.json", "utf8"));
const date = data.summary.weekday.date;
const active = activeServices(data.calendar, data.exceptions, date);
const stop = Object.values(data.stops).find((s: any) =>
  data.departures[s.id].some((e: any) => active.has(e.service)),
) as any;
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(
    new Date(serviceInstant(date, 8 * 3600 + 38 * 60)),
  );
});
test("search, save, timetable, route and device persistence", async ({
  page,
}) => {
  await page.goto("./#/search");
  await page.getByRole("searchbox").fill(stop.code);
  const link = page
    .locator(".stop-link")
    .filter({ hasText: stop.name })
    .first();
  await expect(link).toBeVisible();
  await link
    .locator("..")
    .getByRole("button", { name: `Save stop ${stop.name}`, exact: true })
    .press("Space");
  await page
    .getByRole("link", { name: "Saved", exact: true })
    .filter({ visible: true })
    .press("Enter");
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.locator(".saved-card-header>a").click();
  await expect(page.locator(".departure-hero")).toBeVisible();
  await page
    .getByRole("button", { name: "Show full timetable" })
    .press("Space");
  await expect(page.locator("#full-timetable")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Hide full timetable" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({
    path: "test-results/stop-mobile.png",
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.locator(".departure-hero .badge-link").click();
  await expect(
    page.getByRole("region", { name: /map with stop markers/ }),
  ).toBeVisible();
  await expect(page.locator(".ordered-stops li").first()).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.reload();
  await page.goto("./#/saved");
  await expect(page.locator(".saved-card")).toHaveCount(1);
});
test("nearby geolocation is local and denied/no-results states are usable", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: stop.lat, longitude: stop.lon });
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("./");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.locator(".stop-row")).toHaveCount(5);
  await page.screenshot({
    path: "test-results/nearby-mobile.png",
    fullPage: true,
  });
  expect(requests.every((url) => url.startsWith("http://127.0.0.1:4173"))).toBe(
    true,
  );
  await page.getByRole("searchbox").fill("no-such-street-xyz");
  await expect(page.getByText(/No stops or routes match/)).toBeVisible();
});
test("installed schedule and app shell reload without network", async ({
  page,
  context,
}) => {
  await page.goto(`./#/stop/${stop.id}`);
  await expect(page.locator(".departure-hero")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("metrobus-cache-date")),
    )
    .not.toBeNull();
  const saved = await page.evaluate(() =>
    localStorage.getItem("metrobus-cache-date"),
  );
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText(/You're offline. Showing saved schedule./),
  ).toBeVisible();
  await expect(page.locator(".departure-hero")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("metrobus-cache-date")),
  ).toBe(saved);
  await page.getByRole("button", { name: "Show full timetable" }).click();
  await expect(page.locator("#full-timetable")).toBeVisible();
});

import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync("public/data/schedule.json", "utf8"));
const stop = Object.values(data.stops).find(
  (stop: any) => data.departures[stop.id].length > 0,
) as any;

test("home search updates after typing and deleting without pressing Enter", async ({
  page,
}) => {
  await page.goto("./");
  const input = page.getByRole("searchbox");
  await input.pressSequentially(stop.code, { delay: 25 });
  await expect(
    page.locator(".stop-link").filter({ hasText: stop.name }).first(),
  ).toBeVisible();
  await expect(page.locator('.search-results [role="status"]')).toContainText(
    "stops and",
  );
  await input.fill("unmatched-street-xyz");
  await expect(
    page.getByText("No stops or routes match 'unmatched-street-xyz'."),
  ).toBeVisible();
  await input.fill(stop.name);
  await expect(
    page.locator(".stop-link").filter({ hasText: stop.name }).first(),
  ).toBeVisible();
  await input.fill("");
  await expect(page.getByRole("heading", { name: "Near you" })).toBeVisible();
});

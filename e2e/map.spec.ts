import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync("public/data/schedule.json", "utf8"));

test("Leaflet shows the route, stop markers and visible OpenStreetMap attribution", async ({
  page,
}) => {
  const route = data.routes[0];
  await page.goto(`./#/route/${route.id}`);
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-overlay-pane path")).toHaveAttribute(
    "stroke",
    "var(--accent)",
  );
  await expect(
    page
      .locator(".leaflet-control-attribution")
      .getByRole("link", { name: "OpenStreetMap" }),
  ).toBeVisible();
  await expect(
    page.locator(".leaflet-top.leaflet-right .leaflet-control-attribution"),
  ).toBeVisible();
  await expect
    .poll(() => page.locator(".leaflet-marker-icon").count())
    .toBeGreaterThan(1);
  expect(await page.locator(".leaflet-marker-icon").count()).toBe(
    await page.locator(".ordered-stops li").count(),
  );
  await expect(page.locator(".leaflet-marker-icon[tabindex]")).toHaveCount(0);
  await expect(page.locator(".route-stop-dot").first()).toHaveCSS(
    "width",
    "10px",
  );
  await expect(page.locator(".route-stop-dot").first()).toHaveCSS(
    "height",
    "10px",
  );
  await expect(page.locator(".ordered-stops")).toBeVisible();
});

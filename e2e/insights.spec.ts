import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync("public/data/schedule.json", "utf8"));
test("dashboard recomputes each day, preserves sort, and shows every route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("./#/insights");
  await expect(
    page.getByRole("heading", { name: "Service insights", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".kpi-tile").nth(2)).toContainText(
    String(data.summary.weekday.trips),
  );
  await page.getByRole("button", { name: "Route", exact: true }).click();
  await expect(page.locator("th").first()).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  for (const day of ["Saturday", "Sunday", "Weekday"]) {
    await page.getByRole("button", { name: day, exact: true }).click();
    await expect(page.locator(".kpi-tile").nth(2)).toContainText(
      String(data.summary[day.toLowerCase()].trips),
    );
    await expect(page.locator("th").first()).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  }
  await page.getByRole("button", { name: /Show .* more routes/ }).click();
  if (
    await page.getByRole("button", { name: /Show .* more routes/ }).isVisible()
  )
    await page.getByRole("button", { name: /Show .* more routes/ }).click();
  await expect(page.locator(".route-table tbody tr")).toHaveCount(
    data.summary.weekday.routes.length,
  );
  await page.getByText("View chart data as a list", { exact: true }).click();
  await expect(page.locator(".chart-data li")).toHaveCount(19);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/insights-desktop.png",
    fullPage: true,
  });
});
test("mobile cards, dark mode, narrow reflow and large text remain accessible", async ({
  page,
}) => {
  await page.goto("./#/insights");
  await expect(page.locator(".route-metric-card")).toHaveCount(4);
  await page.getByLabel("Sort by", { exact: true }).selectOption("number-asc");
  await expect(page.locator(".route-metric-card").first()).toContainText(
    "Village-Institutes",
  );
  await page.screenshot({
    path: "test-results/insights-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Use dark mode" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: "test-results/insights-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html{font-size:200%}" });
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.width);
  await page.screenshot({
    path: "test-results/insights-large-text.png",
    fullPage: true,
  });
});

import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync("public/data/schedule.json", "utf8"));

test("data quality uses SQL checks and service gaps identify peak-only stops", async ({
  page,
}) => {
  await page.goto("./#/insights");
  const quality = page
    .locator(".side-panel")
    .filter({
      has: page.getByRole("heading", { name: "Data quality", exact: true }),
    });
  await expect(
    quality.getByText("Every stop is used by at least one trip", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    quality.getByText("Stop times increase within each trip", { exact: true }),
  ).toBeVisible();
  await expect(
    quality.getByText("Stop names are unique", { exact: true }),
  ).toHaveCount(0);
  await expect(quality.locator(".quality-list>li")).toHaveCount(5);
  if (data.meta.unusedStopIds.length) {
    await quality
      .getByText(`Unused stop IDs (${data.meta.unusedStopIds.length})`, {
        exact: true,
      })
      .click();
    for (const id of data.meta.unusedStopIds)
      await expect(
        quality.getByRole("link", { name: id, exact: true }),
      ).toBeVisible();
  } else await expect(quality.getByText(/No unused stop IDs/)).toBeVisible();
  const gaps = page.locator(".gap-list>li");
  for (const [i, gap] of data.summary.weekday.gaps.slice(0, 6).entries()) {
    await expect(
      gaps.nth(i).getByText("Peak only", { exact: true }),
    ).toHaveCount(gap.last < 36000 ? 1 : 0);
  }
  await expect(page.getByText(/About every \d+\.\d+ min/)).toHaveCount(0);
});

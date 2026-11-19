import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("keyboard skip link focuses content without changing the active screen", async ({
  page,
}) => {
  for (const path of [
    "nearby",
    "search",
    "saved",
    "insights",
    "stop/1000",
    "route/1",
  ]) {
    await page.goto(`./#/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(
      "Loading schedule",
    );
    await expect(page.locator(".loading")).toHaveCount(0);
    const url = page.url();
    const heading = await page.getByRole("heading", { level: 1 }).textContent();
    await page.getByRole("link", { name: "Skip to content" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading!);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toHaveCount(0);
  }
});

test("top-level screens have accessible landmarks and empty states", async ({
  page,
}) => {
  for (const path of ["nearby", "search", "saved"]) {
    await page.goto(`./#/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator(".loading")).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await expect(page.getByText(/No saved stops yet/)).toBeVisible();
});
test("denied location and distant locations keep search available", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_: unknown, error: (e: unknown) => void) =>
          error({ code: 1 }),
      },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(
    page.getByText(/Location is off. Search for a stop instead./),
  ).toBeVisible();
  await expect(page.getByRole("searchbox")).toBeVisible();
  await context.clearPermissions();
});
test("failed schedule fetch gives a retry and the no-cache offline message", async ({
  page,
  context,
}) => {
  await page.route("**/data/schedule.json", (route) => route.abort());
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Schedule unavailable" }),
  ).toBeVisible();
  await context.setOffline(true);
  await expect(
    page.getByText(
      "You're offline and no schedule is saved yet. Connect once to save it.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { loginAs, logout } from "./helpers/auth";
import { DASHBOARD_ROUTES, LOGIN_PATH } from "./helpers/test-data";

test.describe("Mobile Responsiveness", () => {
  test("Login page works on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in|login|submit/i }),
    ).toBeVisible();
  });

  test("Dashboard page loads on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAs(
      page,
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!,
    );

    await page.goto(DASHBOARD_ROUTES.home);
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    expect(currentUrl).toContain("/en");

    await logout(page);
  });

  test("Navigation is accessible on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAs(
      page,
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!,
    );

    await page.goto(DASHBOARD_ROUTES.home);
    await page.waitForLoadState("networkidle");

    const menuButton = page.getByRole("button", { name: /menu|hamburger|toggle|nav/i });
    if (await menuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuButton.click();
      await page.waitForTimeout(500);
      const navLinks = page.getByRole("link");
      const linkCount = await navLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    }

    await logout(page);
  });

  test("Reservations page loads on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAs(
      page,
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!,
    );

    await page.goto(DASHBOARD_ROUTES.reservations);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/reservations");

    await logout(page);
  });

  test("Settings page is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await loginAs(
      page,
      process.env.TEST_ADMIN_EMAIL!,
      process.env.TEST_ADMIN_PASSWORD!,
    );

    await page.goto(DASHBOARD_ROUTES.settings);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/settings");

    await logout(page);
  });
});

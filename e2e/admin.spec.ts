import { expect, test } from "@playwright/test";
import { loginAs, requireEnv, logout } from "./helpers/auth";
import { DASHBOARD_ROUTES } from "./helpers/test-data";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, requireEnv("TEST_ADMIN_EMAIL"), requireEnv("TEST_ADMIN_PASSWORD"));
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test("Admin dashboard loads", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.home);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/en(\/dashboard)?$/);
  });

  test("Admin can view reservations page", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.reservations);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/reservations");
  });

  test("Admin can view contacts page", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.contacts);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/contacts");
  });

  test("Admin can view users page", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.users);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/users");
  });

  test("Admin can view accounting page", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.accounting);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/accounting");
  });

  test("Admin can view settings page", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.settings);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/settings");
  });

  test("Admin can view logs page", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.logs);
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/logs");
  });

  test("Admin can navigate via sidebar links", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.home);
    await page.waitForLoadState("networkidle");

    const sidebar = page.locator("nav");
    const reservationLink = sidebar.getByRole("link").filter({ hasText: /reservations|bookings/i }).first();
    if (await reservationLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reservationLink.click();
      await page.waitForURL(/\/en\/reservations/, { timeout: 5000 });
      expect(page.url()).toContain("/reservations");
    }
  });
});

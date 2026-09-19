import { expect, test } from "@playwright/test";
import { loginAs, requireEnv, logout } from "./helpers/auth";
import { BASE_PATH, LOGIN_PATH } from "./helpers/test-data";

test.describe("Authentication", () => {
  test("Login page loads successfully", async ({ page }) => {
    const response = await page.goto(LOGIN_PATH);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("Valid admin login works", async ({ page }) => {
    await loginAs(page, requireEnv("TEST_ADMIN_EMAIL"), requireEnv("TEST_ADMIN_PASSWORD"));
    expect(page.url()).not.toContain("/login");
  });

  test("Valid front_desk login works", async ({ page }) => {
    await loginAs(page, requireEnv("TEST_FRONT_DESK_EMAIL"), requireEnv("TEST_FRONT_DESK_PASSWORD"));
    expect(page.url()).not.toContain("/login");
  });

  test("Valid accountant login works", async ({ page }) => {
    await loginAs(page, requireEnv("TEST_ACCOUNTANT_EMAIL"), requireEnv("TEST_ACCOUNTANT_PASSWORD"));
    expect(page.url()).not.toContain("/login");
  });

  test("Invalid login stays on login page", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/email/i).fill("wrong@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|login|submit/i }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const stillOnLogin = page.url().includes("/login");
    const hasError = await page.getByText(/invalid|error|incorrect|wrong|failed/i).isVisible().catch(() => false);
    expect(stillOnLogin || hasError).toBe(true);
  });

  test("Logout works", async ({ page }) => {
    await loginAs(page, requireEnv("TEST_ADMIN_EMAIL"), requireEnv("TEST_ADMIN_PASSWORD"));

    await logout(page);

    await page.goto("/en/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("Protected pages redirect unauthenticated users", async ({ page }) => {
    await page.goto(BASE_PATH);
    await page.waitForLoadState("networkidle");
    const currentUrl = page.url();
    expect(currentUrl).toContain("/login");
  });
});

import { expect, test } from "@playwright/test";
import { loginAs, requireEnv, logout } from "./helpers/auth";
import { DASHBOARD_ROUTES, LOGIN_PATH } from "./helpers/test-data";

test.describe("Authorization & Security", () => {
  test("Unauthenticated user cannot access dashboard pages", async ({ page }) => {
    for (const [, route] of Object.entries(DASHBOARD_ROUTES)) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const currentUrl = page.url();
      expect(currentUrl).not.toContain("/dashboard");
    }
  });

  test("Unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto(DASHBOARD_ROUTES.reservations);
    await page.waitForLoadState("networkidle");
    const currentUrl = page.url();
    expect(
      currentUrl.includes("/login") || currentUrl.includes("/unauthorized"),
    ).toBe(true);
  });

  test("Front desk user cannot access admin-only accounting page", async ({ page }) => {
    await loginAs(page, requireEnv("TEST_FRONT_DESK_EMAIL"), requireEnv("TEST_FRONT_DESK_PASSWORD"));

    await page.goto(DASHBOARD_ROUTES.accounting);
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    const blocked =
      currentUrl.includes("/unauthorized") ||
      currentUrl.includes("/login");
    expect(blocked).toBe(true);

    await logout(page);
  });

  test("Front desk user cannot access admin-only users page", async ({ page }) => {
    await loginAs(page, requireEnv("TEST_FRONT_DESK_EMAIL"), requireEnv("TEST_FRONT_DESK_PASSWORD"));

    await page.goto(DASHBOARD_ROUTES.users);
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    const blocked =
      currentUrl.includes("/unauthorized") ||
      currentUrl.includes("/login");
    expect(blocked).toBe(true);

    await logout(page);
  });

  test("Sensitive env vars not exposed in rendered HTML", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    expect(html).not.toContain(serviceKey);
    expect(html).not.toContain("service_role");
  });

  test("Common invalid inputs do not break the login page", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");

    const payloads = [
      "<script>alert(1)</script>",
      "' OR '1'='1",
      "../../etc/passwd",
      "a".repeat(1000),
    ];

    for (const payload of payloads) {
      await page.goto(LOGIN_PATH);
      await page.waitForLoadState("networkidle");
      await page.getByLabel(/email/i).fill(payload);
      await page.getByLabel(/password/i).fill(payload);
      await page.getByRole("button", { name: /sign in|login|submit/i }).click();
      await page.waitForLoadState("networkidle");

      const hasError = await page.getByText(/invalid|error|incorrect/i).isVisible().catch(() => false);
      const pageIntact = await page.getByRole("heading", { level: 1 }).isVisible();
      expect(pageIntact).toBe(true);
    }
  });
});

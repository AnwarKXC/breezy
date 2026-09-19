import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var "${name}". ` +
        `Check that it is set in .env.test (see .env.test.example for the template).`,
    );
  }
  return value;
}

export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  if (!email || !password) {
    throw new Error(
      `loginAs requires email and password, got email=${typeof email} password=${typeof password}`,
    );
  }

  await page.goto("/en/login");
  await page.waitForLoadState("networkidle");

  const emailInput = page.getByLabel(/email/i);
  const passwordInput = page.getByLabel(/password/i);

  await emailInput.fill(email);
  await passwordInput.fill(password);

  await page.getByRole("button", { name: /sign in|login|submit/i }).click();

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  await page.goto("/en", { waitUntil: "networkidle", timeout: 15000 });

  const onLoginPage = page.url().includes("/login");
  if (onLoginPage) {
    const errorEl = page.getByText(/invalid|error|incorrect|wrong|failed/i);
    const errorVisible = await errorEl.isVisible().catch(() => false);
    const errorMsg = errorVisible ? await errorEl.textContent() : "no visible error element";
    throw new Error(
      `loginAs failed for "${email}": ${errorMsg}\n` +
        "Check that:\n" +
        "  1. The user exists in Supabase Auth\n" +
        "  2. The password is correct\n" +
        "  3. A matching profile exists in the profiles table\n" +
        "  4. The profile has the expected role",
    );
  }
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginAs(page, requireEnv("TEST_ADMIN_EMAIL"), requireEnv("TEST_ADMIN_PASSWORD"));
}

export async function loginAsFrontDesk(page: Page): Promise<void> {
  await loginAs(page, requireEnv("TEST_FRONT_DESK_EMAIL"), requireEnv("TEST_FRONT_DESK_PASSWORD"));
}

export async function loginAsAccountant(page: Page): Promise<void> {
  await loginAs(page, requireEnv("TEST_ACCOUNTANT_EMAIL"), requireEnv("TEST_ACCOUNTANT_PASSWORD"));
}

export async function loginAsGuest(page: Page): Promise<void> {
  await loginAs(page, requireEnv("TEST_GUEST_EMAIL"), requireEnv("TEST_GUEST_PASSWORD"));
}

export async function logout(page: Page): Promise<void> {
  const logoutButton = page.getByRole("button", { name: /logout|sign out|log out/i });
  if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutButton.click({ force: true, timeout: 3000 });
    await page.waitForLoadState("networkidle");
  }
}

export function generateUniqueTestEmail(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `e2e-test-${ts}-${rand}@hotel.test`;
}

export async function expectNoConsoleErrors(page: Page): Promise<void> {
  const logs: { type: string; text: string }[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      logs.push({ type: msg.type(), text: msg.text() });
    }
  });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  if (logs.length > 0) {
    const serious = logs.filter(
      (l) =>
        !l.text.includes("favicon") &&
        !l.text.includes("Failed to load resource") &&
        !l.text.includes("404") &&
        !l.text.includes("503"),
    );
    expect(serious).toEqual([]);
  }
}

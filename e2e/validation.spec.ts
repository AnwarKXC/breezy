import { expect, test } from "@playwright/test";
import { LOGIN_PATH } from "./helpers/test-data";

test.describe("Form Validation", () => {
  test("Login form rejects empty fields", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");

    const submitButton = page.getByRole("button", { name: /sign in|login|submit/i });
    const isDisabled = await submitButton.isDisabled();
    if (isDisabled) {
      expect(isDisabled).toBe(true);
      return;
    }

    await submitButton.click();
    await page.waitForLoadState("networkidle");

    const emailInput = page.getByLabel(/email/i);
    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );
    expect(validationMessage).toBeTruthy();
  });

  test("Login form rejects invalid email format", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");

    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill("not-an-email");
    await page.getByLabel(/password/i).fill("somepassword");

    const submitButton = page.getByRole("button", { name: /sign in|login|submit/i });
    await submitButton.click();
    await page.waitForLoadState("networkidle");

    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    );
    expect(validationMessage).toBeTruthy();
  });

  test("Login form rejects very short password", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/email/i).fill("user@hotel.test");
    await page.getByLabel(/password/i).fill("ab");

    const submitButton = page.getByRole("button", { name: /sign in|login|submit/i });
    await submitButton.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const stillOnLogin = page.url().includes("/login");
    const hasError = await page.getByText(/invalid|error|incorrect/i).isVisible().catch(() => false);
    expect(stillOnLogin || hasError).toBe(true);
  });

  test("Login page does not break with XSS attempt in email field", async ({ page }) => {
    await page.goto(LOGIN_PATH);
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/email/i).fill("<img src=x onerror=alert(1)>");
    await page.getByLabel(/password/i).fill("test123");
    await page.getByRole("button", { name: /sign in|login|submit/i }).click();
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });
});

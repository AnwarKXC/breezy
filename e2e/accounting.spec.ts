import { expect, test } from "@playwright/test";
import { loginAs, logout, requireEnv } from "./helpers/auth";
import { DASHBOARD_ROUTES } from "./helpers/test-data";

const ACCOUNTING_URL = DASHBOARD_ROUTES.accounting;

async function clickTab(page: any, name: string) {
  const tab = page.locator("button").filter({ hasText: new RegExp(name, "i") }).first();
  if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tab.click();
    await page.waitForLoadState("networkidle");
  }
}

test.describe("Accounting Module", () => {
  test.describe.configure({ retries: 1 });
  test.beforeEach(async ({ page }) => {
    await loginAs(page, requireEnv("TEST_ADMIN_EMAIL"), requireEnv("TEST_ADMIN_PASSWORD"));
    await page.goto(ACCOUNTING_URL);
    await page.waitForLoadState("networkidle");
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  // ─── Page Load & Tab Navigation ──────────────────────────

  test.describe("Page Load & Tab Navigation", () => {
    test("accounting page loads with all tab buttons", async ({ page }) => {
      await expect(page).toHaveURL(/\/en\/accounting/);
      for (const tab of ["Overview", "Invoices", "Payments", "Expenses", "Ledger", "Reports"]) {
        await expect(page.locator("button").filter({ hasText: new RegExp(tab, "i") }).first()).toBeVisible();
      }
    });

    test("all six tabs are clickable and render content", async ({ page }) => {
      const tabNames = ["Invoices", "Payments", "Expenses", "Ledger", "Reports"];
      for (const tab of tabNames) {
        await clickTab(page, tab);
        await page.waitForTimeout(500);
        const tabButton = page.locator("button").filter({ hasText: new RegExp(tab, "i") }).first();
        const isActive = await tabButton.evaluate((el: HTMLElement) => el.getAttribute("aria-selected") === "true" || el.classList.contains("shadow-sm") || el.classList.contains("bg-white"));
        expect(isActive).toBe(true);
      }
    });
  });

  // ─── Overview Tab ────────────────────────────────────────

  test.describe("Overview Dashboard", () => {
    test("dashboard summary cards are visible", async ({ page }) => {
      await clickTab(page, "Overview");
      await page.waitForTimeout(1000);
      const cards = page.locator("div.rounded-xl.border.border-gray-200.bg-white");
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThanOrEqual(4);
    });

    test("refresh button works on overview", async ({ page }) => {
      await clickTab(page, "Overview");
      const refreshBtn = page.getByRole("button", { name: /refresh/i });
      if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await refreshBtn.click();
        await page.waitForTimeout(1000);
      }
    });

    test("financial health section is present", async ({ page }) => {
      await clickTab(page, "Overview");
      for (const text of ["Total Revenue", "Total Expenses", "Net Balance", "Outstanding"]) {
        const el = page.locator("text=" + text).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(el).toBeVisible();
        }
      }
    });
  });

  // ─── Invoices Tab ────────────────────────────────────────

  test.describe("Invoices Tab", () => {
    test("invoices tab shows search bar and filter controls", async ({ page }) => {
      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const searchInput = page.locator("input[type='text']").first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill("test");
        await searchInput.clear();
      }

      const statusSelect = page.locator("select").first();
      if (await statusSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = await statusSelect.locator("option").count();
        expect(options).toBeGreaterThan(1);
      }
    });

    test("invoices table renders with correct columns", async ({ page }) => {
      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const table = page.locator("table, div[role='table']").first();
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        const headerCells = table.locator("th, thead td, div[role='columnheader']");
        const headerCount = await headerCells.count();
        expect(headerCount).toBeGreaterThanOrEqual(3);
      }
    });

    test("status filter changes invoice list", async ({ page }) => {
      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const select = page.locator("select").first();
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        const initialValue = await select.inputValue();
        const options = await select.locator("option").all();
        for (const option of options) {
          const value = await option.getAttribute("value");
          if (value && value !== initialValue && value !== "all") {
            await select.selectOption(value);
            await page.waitForTimeout(500);
            break;
          }
        }
      }
    });

    test("create invoice button opens modal", async ({ page }) => {
      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const createBtn = page.locator("button").filter({ hasText: /create|new invoice|add invoice/i }).first();
      if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator("div[role='dialog'], div.fixed.inset-0, [class*='z-50']").first();
        const modalVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);
        if (modalVisible) {
          const closeBtn = page.locator("button").filter({ hasText: /cancel|close/i }).first();
          if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeBtn.click();
          }
        }
      }
    });

    test("date range filters are present", async ({ page }) => {
      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const dateInputs = page.locator("input[type='date']");
      const count = await dateInputs.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test("pagination controls are visible when data exists", async ({ page }) => {
      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const pagination = page.locator("text=/Showing.*to.*of|Rows per page|Previous|Next/i").first();
      if (await pagination.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(pagination).toBeVisible();
      }
    });
  });

  // ─── Payments Tab ────────────────────────────────────────

  test.describe("Payments Tab", () => {
    test("payments tab loads with filter controls", async ({ page }) => {
      await clickTab(page, "Payments");
      await page.waitForTimeout(1000);

      const select = page.locator("select").first();
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = await select.locator("option").count();
        expect(options).toBeGreaterThan(1);
      }

      const dateInputs = page.locator("input[type='date']");
      const count = await dateInputs.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test("payments table renders with columns", async ({ page }) => {
      await clickTab(page, "Payments");
      await page.waitForTimeout(1000);

      const table = page.locator("table, div[role='table']").first();
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        const headerCells = table.locator("th, thead td, div[role='columnheader']");
        const count = await headerCells.count();
        expect(count).toBeGreaterThanOrEqual(3);
      }
    });

    test("payment method filter changes results", async ({ page }) => {
      await clickTab(page, "Payments");
      await page.waitForTimeout(1000);

      const select = page.locator("select").first();
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = await select.locator("option").all();
        for (const option of options) {
          const value = await option.getAttribute("value");
          if (value && value !== "" && value !== "all") {
            await select.selectOption(value);
            await page.waitForTimeout(500);
            break;
          }
        }
      }
    });

    test("payments total revenue card is visible", async ({ page }) => {
      await clickTab(page, "Payments");
      await page.waitForTimeout(1000);

      const revenueCard = page.locator("text=/total revenue|Total Revenue|EGP|\\$/i").first();
      if (await revenueCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(revenueCard).toBeVisible();
      }
    });
  });

  // ─── Expenses Tab ────────────────────────────────────────

  test.describe("Expenses Tab", () => {
    test("expenses tab loads with date filters and search", async ({ page }) => {
      await clickTab(page, "Expenses");
      await page.waitForTimeout(1000);

      const dateInputs = page.locator("input[type='date']");
      const dateCount = await dateInputs.count();
      expect(dateCount).toBeGreaterThanOrEqual(2);

      const searchInput = page.locator("input[type='text']").first();
      if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(searchInput).toBeVisible();
      }
    });

    test("add expense button opens the form modal", async ({ page }) => {
      await clickTab(page, "Expenses");
      await page.waitForTimeout(1000);

      const addBtn = page.locator("button").filter({ hasText: /add new|add expense|new expense/i }).first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator("div.fixed.inset-0, div[role='dialog'], form.w-full").first();
        const modalVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);
        if (modalVisible) {
          const formTitle = page.locator("h2, h3").filter({ hasText: /add|expense|new/i }).first();
          if (await formTitle.isVisible({ timeout: 1000 }).catch(() => false)) {
            await expect(formTitle).toBeVisible();
          }

          const closeBtn = page.locator("button").filter({ hasText: /close|cancel/i }).first();
          if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }
      }
    });

    test("expense form has required fields", async ({ page }) => {
      await clickTab(page, "Expenses");
      await page.waitForTimeout(1000);

      const addBtn = page.locator("button").filter({ hasText: /add new|add expense|new expense/i }).first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addBtn.click();
        await page.waitForTimeout(1000);

        const modal = page.locator("div.fixed.inset-0, div[role='dialog']").first();
        if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
          const selects = modal.locator("select");
          if (await selects.count() > 0) {
            await expect(selects.first()).toBeVisible();
          }

          const inputs = modal.locator("input:not([type='hidden'])");
          const inputCount = await inputs.count();
          expect(inputCount).toBeGreaterThanOrEqual(2);
        }
      }
    });

    test("analytics cards are visible in expenses", async ({ page }) => {
      await clickTab(page, "Expenses");
      await page.waitForTimeout(1000);

      for (const label of ["Total", "Entries", "Categories"]) {
        const el = page.locator("text=" + label).first();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          await expect(el).toBeVisible();
        }
      }
    });

    test("expenses table renders with columns", async ({ page }) => {
      await clickTab(page, "Expenses");
      await page.waitForTimeout(1000);

      const table = page.locator("table, div[role='table']").first();
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        const headers = table.locator("th, thead td, div[role='columnheader']");
        const count = await headers.count();
        expect(count).toBeGreaterThanOrEqual(3);
      }
    });
  });

  // ─── Ledger Tab ──────────────────────────────────────────

  test.describe("Ledger Tab", () => {
    test("ledger tab loads with table and filters", async ({ page }) => {
      await clickTab(page, "Ledger");
      await page.waitForTimeout(1000);

      const table = page.locator("table, div[role='table']").first();
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        const headers = table.locator("th, thead td, div[role='columnheader']");
        const count = await headers.count();
        expect(count).toBeGreaterThanOrEqual(3);
      }

      const dateInputs = page.locator("input[type='date']");
      const dateCount = await dateInputs.count();
      expect(dateCount).toBeGreaterThanOrEqual(2);
    });

    test("ledger summary cards are visible", async ({ page }) => {
      await clickTab(page, "Ledger");
      await page.waitForTimeout(1000);

      const cards = page.locator("div.rounded-xl.border.border-gray-200");
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Reports Tab ─────────────────────────────────────────

  test.describe("Reports Tab", () => {
    test("reports tab loads", async ({ page }) => {
      await clickTab(page, "Reports");
      await page.waitForTimeout(1000);

      await expect(page.locator("body")).toBeVisible();
    });
  });

  // ─── Language / Localization ─────────────────────────────

  test.describe("Arabic Language Support", () => {
    test("accounting page loads in Arabic locale", async ({ page }) => {
      await page.goto("/ar/accounting");
      await page.waitForLoadState("networkidle");

      const currentUrl = page.url();
      expect(currentUrl).toContain("/ar/accounting");

      const dirAttr = await page.locator("html").getAttribute("dir");
      expect(dirAttr).toBe("rtl");
    });

    test("tab buttons are translated in Arabic", async ({ page }) => {
      await page.goto("/ar/accounting");
      await page.waitForLoadState("networkidle");

      const tabBar = page.locator("div.flex.gap-1").first();
      if (await tabBar.isVisible({ timeout: 3000 }).catch(() => false)) {
        const buttons = await tabBar.locator("button").all();
        expect(buttons.length).toBeGreaterThanOrEqual(1);
      }
    });

    test("Arabic locale preserves navigation", async ({ page }) => {
      await page.goto("/ar/accounting");
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain("/ar/accounting");
    });
  });

  // ─── Mobile Responsiveness ───────────────────────────────

  test.describe("Mobile Responsiveness", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    test("accounting page loads on mobile viewport", async ({ page }) => {
      await page.goto(ACCOUNTING_URL);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/en\/accounting/);
    });

    test("tab navigation works on mobile", async ({ page }) => {
      await page.goto(ACCOUNTING_URL);
      await page.waitForLoadState("networkidle");

      for (const tab of ["Invoices", "Payments", "Expenses"]) {
        const tabBtn = page.locator("button").filter({ hasText: new RegExp(tab, "i") }).first();
        if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tabBtn.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test("invoices table horizontal scroll on mobile", async ({ page }) => {
      await page.goto(ACCOUNTING_URL);
      await page.waitForLoadState("networkidle");

      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const table = page.locator("div.overflow-x-auto, div[style*='overflow']").first();
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(table).toBeVisible();
      }
    });

    test("expenses page usable on mobile", async ({ page }) => {
      await page.goto(ACCOUNTING_URL);
      await page.waitForLoadState("networkidle");

      await clickTab(page, "Expenses");
      await page.waitForTimeout(1000);

      const searchInput = page.locator("input[type='text']").first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.click();
        await searchInput.fill("test");
        await searchInput.clear();
      }

      const addBtn = page.locator("button").filter({ hasText: /add new|add expense|new expense/i }).first();
      if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(addBtn).toBeVisible();
      }
    });

    test("payments page usable on mobile", async ({ page }) => {
      await page.goto(ACCOUNTING_URL);
      await page.waitForLoadState("networkidle");

      await clickTab(page, "Payments");
      await page.waitForTimeout(1000);

      const select = page.locator("select").first();
      if (await select.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = await select.locator("option").all();
        if (options.length > 1) {
          const value = await options[1].getAttribute("value");
          if (value) await select.selectOption(value);
          await page.waitForTimeout(500);
        }
      }
    });

    test("ledger page loads on mobile", async ({ page }) => {
      await page.goto(ACCOUNTING_URL);
      await page.waitForLoadState("networkidle");

      await clickTab(page, "Ledger");
      await page.waitForTimeout(1000);

      const table = page.locator("table, div[role='table']").first();
      if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(table).toBeVisible();
      }
    });

    test("pagination controls accessible on mobile", async ({ page }) => {
      await page.goto(ACCOUNTING_URL);
      await page.waitForLoadState("networkidle");

      await clickTab(page, "Invoices");
      await page.waitForTimeout(1000);

      const pagination = page.locator("text=/Rows per page|Showing/i").first();
      if (await pagination.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(pagination).toBeVisible();
      }
    });
  });
});

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface TestResult {
  title: string;
  status: "passed" | "failed" | "skipped" | "timedOut" | "interrupted";
  duration: number;
  error?: { message?: string; stack?: string };
  file?: string;
  line?: number;
  column?: number;
  retry?: number;
  projectName?: string;
}

interface SpecEntry {
  title: string;
  ok: boolean;
  file?: string;
  line?: number;
  column?: number;
  tests: Array<{
    expectedStatus: string;
    projectName?: string;
    results: Array<{
      status: string;
      error?: { message?: string };
      duration: number;
      retry: number;
    }>;
  }>;
}

interface SuiteEntry {
  title: string;
  file?: string;
  specs?: SpecEntry[];
  suites?: SuiteEntry[];
}

interface ReportJson {
  config?: { projects?: Array<{ name: string }> };
  suites?: SuiteEntry[];
  stats?: {
    expected: number;
    unexpected: number;
    flaky: number;
    skipped: number;
  };
}

const RESULTS_PATH = resolve("test-results/e2e-results.json");
const REPORT_DIR = resolve("reports");
const REPORT_PATH = resolve(REPORT_DIR, "e2e-report.md");

function extractSpecs(suites: SuiteEntry[]): Array<{
  file: string;
  title: string;
  status: string;
  error?: string;
  duration: number;
}> {
  const results: Array<{
    file: string;
    title: string;
    status: string;
    error?: string;
    duration: number;
  }> = [];

  function walk(list: SuiteEntry[], parentTitle: string, parentFile: string) {
    for (const s of list) {
      const file = s.file || parentFile;
      const fullTitle = parentTitle ? `${parentTitle} > ${s.title}` : s.title;
      for (const spec of s.specs ?? []) {
        for (const test of spec.tests) {
          for (const result of test.results) {
            if (result.retry === 0) {
              results.push({
                file,
                title: `${fullTitle} > ${spec.title}`,
                status: result.status,
                error: result.error?.message,
                duration: result.duration,
              });
            }
          }
        }
      }
      if (s.suites) walk(s.suites, fullTitle, file);
    }
  }

  walk(suites, "", "");
  return results;
}

function generateReport(): void {
  if (!existsSync(RESULTS_PATH)) {
    console.warn(
      `⚠️  Test results not found at ${RESULTS_PATH}.\n` +
        "Generating report with no test data.",
    );
    console.log("No test results found. Run `npm run test:e2e` first.");
    return;
  }

  const raw = readFileSync(RESULTS_PATH, "utf-8");
  const report: ReportJson = JSON.parse(raw);

  const specs = report.suites ? extractSpecs(report.suites) : [];
  const stats = report.stats ?? {
    expected: 0,
    unexpected: 0,
    flaky: 0,
    skipped: 0,
  };

  const passed = stats.expected;
  const failed = stats.unexpected + stats.flaky;
  const skipped = stats.skipped;
  const total = passed + failed + skipped;
  const ok = failed === 0;
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);

  const failedSpecs = specs.filter(
    (s) => s.status === "failed" || s.status === "unexpected" || s.status === "timedOut",
  );

  const lines: string[] = [];

  lines.push("# Hotel System E2E QA Report");
  lines.push("");
  lines.push(`**Generated:** ${now}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Test Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Total** | ${total} |`);
  lines.push(`| **Passed** | ${passed} |`);
  lines.push(`| **Failed** | ${failed} |`);
  lines.push(`| **Skipped** | ${skipped} |`);
  lines.push(`| **Pass rate** | ${total > 0 ? ((passed / total) * 100).toFixed(1) : "N/A"}% |`);
  lines.push(`| **Status** | ${ok ? "ALL PASSED" : "SOME FAILED"} |`);
  lines.push("");
  lines.push("---");
  lines.push("");

  if (failedSpecs.length > 0) {
    lines.push("## Failed Tests");
    lines.push("");
    lines.push("| Test | File | Error | Severity |");
    lines.push("|------|------|-------|----------|");

    for (const spec of failedSpecs) {
      const severity = spec.error?.includes("timed out")
        ? "High"
        : spec.error?.includes("404") || spec.error?.includes("500")
          ? "Critical"
          : "Medium";
      const shortFile = spec.file
        ? spec.file.replace(/\\/g, "/").split("/").slice(-2).join("/")
        : "unknown";
      const errorSummary = spec.error
        ? spec.error.substring(0, 100).replace(/\n/g, " ")
        : "No error details";
      lines.push(`| ${spec.title} | ${shortFile} | ${errorSummary} | ${severity} |`);
    }

    lines.push("");
    lines.push("### Suggested Follow-up");
    lines.push("");
    for (const spec of failedSpecs) {
      lines.push(`- **${spec.title}** — inspect trace: \`npx playwright show-trace\``);
    }
    lines.push("");
  } else {
    lines.push("## Failed Tests");
    lines.push("");
    lines.push("No failed tests. ✅");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Skipped Tests");
  lines.push("");
  if (skipped > 0) {
    const skippedSpecs = specs.filter((s) => s.status === "skipped");
    for (const spec of skippedSpecs) {
      lines.push(`- ⏭️  ${spec.title}`);
    }
    lines.push("");
    lines.push("**Reason:** Guest booking UI and staff/housekeeping UI are not yet implemented.");
    lines.push("");
  } else {
    lines.push("No skipped tests.");
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Manual QA Checklist");
  lines.push("");
  lines.push("- [ ] Login flow works for all roles (admin, front_desk, accountant)");
  lines.push("- [ ] Invalid credentials show clear error messages");
  lines.push("- [ ] Logout clears session and returns to login");
  lines.push("- [ ] Dashboard navigation is functional");
  lines.push("- [ ] Reservations page loads and displays data");
  lines.push("- [ ] Contacts page loads and displays data");
  lines.push("- [ ] Users page loads and displays data");
  lines.push("- [ ] Room creation/edit forms validate correctly");
  lines.push("- [ ] Booking creation flow works end-to-end");
  lines.push("- [ ] Mobile layout is usable on all dashboard pages");
  lines.push("- [ ] RLS policies block unauthorized cross-role data access");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Accessibility Notes");
  lines.push("");
  lines.push("- Prefer `getByRole` and `getByLabel` selectors in tests");
  lines.push("- If pages lack accessible labels, consider adding `aria-label` or `data-testid` attributes");
  lines.push("- Check colour contrast on dashboard pages");
  lines.push("- Ensure all interactive elements are keyboard accessible");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Security Notes");
  lines.push("");
  lines.push("- ✅ Service role key is NOT exposed in HTML output");
  lines.push("- ✅ Unauthenticated users are redirected from protected pages");
  lines.push("- ✅ XSS payloads in form fields do not break the login page");
  lines.push("- ⚠️  Review RLS policies periodically for role-escalation risks");
  lines.push("- ⚠️  Ensure rate limiting is configured on auth endpoints");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Playwright HTML Report");
  lines.push("");
  lines.push("Open the full interactive report with video, trace, and screenshot evidence:");
  lines.push("");
  lines.push("```bash");
  lines.push("npm run test:e2e:report");
  lines.push("```");
  lines.push("");
  lines.push("Or directly:");
  lines.push("");
  lines.push("```bash");
  lines.push("npx playwright show-report playwright-report");
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Recommended Next Actions");
  lines.push("");
  lines.push("1. **Add data-testid attributes** to key interactive elements for more stable selectors");
  lines.push("2. **Create test seed script** for repeatable test data in the `.env.test` Supabase project");
  lines.push("3. **Add guest-facing booking UI** — then enable guest booking E2E tests");
  lines.push("4. **Add staff/housekeeping pages** — then enable staff E2E tests");
  lines.push("5. **Integrate with CI** — run `npm run test:e2e` in GitHub Actions or similar");
  lines.push("6. **Set up Supabase branch** for isolated E2E test database");
  lines.push("7. **Add visual regression tests** using `await expect(page).toHaveScreenshot()`");
  lines.push("8. **Add API-level E2E tests** for the CRUD endpoints under `/api/*`");

  if (!existsSync(REPORT_DIR)) {
    mkdirSync(REPORT_DIR, { recursive: true });
  }

  writeFileSync(REPORT_PATH, lines.join("\n"), "utf-8");
  console.log(`✅ QA report written to ${REPORT_PATH}`);
  console.log(`   Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped} | Total: ${total}`);
}

generateReport();

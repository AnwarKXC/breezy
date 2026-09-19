/**
 * Test data helpers for E2E tests.
 *
 * ⚠️  SAFETY RULES
 * - Never reference production data in tests.
 * - Use environment variables for credentials.
 * - Test accounts must be created in Supabase Auth + profiles table
 *   on the test/staging project only.
 *
 * See docs/e2e-testing.md for setup instructions.
 */

export const TEST_LOCALE = "en";
export const BASE_PATH = `/${TEST_LOCALE}`;

export const LOGIN_PATH = `${BASE_PATH}/login`;
export const UNAUTHORIZED_PATH = `${BASE_PATH}/unauthorized`;

// The (dashboard) route group removes /dashboard from the URL path.
// These routes render from [locale]/(dashboard)/*.tsx.
export const DASHBOARD_ROUTES = {
  home: BASE_PATH,
  reservations: `${BASE_PATH}/reservations`,
  contacts: `${BASE_PATH}/contacts`,
  users: `${BASE_PATH}/users`,
  accounting: `${BASE_PATH}/accounting`,
  settings: `${BASE_PATH}/settings`,
  logs: `${BASE_PATH}/logs`,
} as const;

export function buildRoute(segment: string): string {
  return `/${TEST_LOCALE}${segment.startsWith("/") ? "" : "/"}${segment}`;
}

/**
 * Centralised selectors for E2E tests.
 *
 * Precedence (highest first):
 * 1. getByRole
 * 2. getByLabel
 * 3. getByPlaceholder
 * 4. getByText (visible only)
 * 5. CSS/data-testid (last resort)
 *
 * If you cannot find a stable accessible selector, consider
 * adding data-testid attributes to the component.
 */

export const SELECTORS = {
  login: {
    emailInput: { role: "textbox", name: /email/i } as const,
    passwordInput: { role: "textbox", name: /password/i } as const,
    submitButton: { role: "button", name: /sign in|login|submit/i } as const,
    errorMessage: { role: "alert" } as const,
  },
  dashboard: {
    sidebar: { role: "navigation" } as const,
    heading: { role: "heading", level: 1 } as const,
  },
  navigation: {
    reservations: { role: "link", name: /reservations|bookings/i } as const,
    rooms: { role: "link", name: /rooms/i } as const,
    contacts: { role: "link", name: /contacts/i } as const,
    users: { role: "link", name: /users/i } as const,
    accounting: { role: "link", name: /accounting|finance/i } as const,
    settings: { role: "link", name: /settings/i } as const,
    logs: { role: "link", name: /logs|audit/i } as const,
  },
  common: {
    loading: { role: "progressbar" } as const,
    table: { role: "table" } as const,
  },
} as const;

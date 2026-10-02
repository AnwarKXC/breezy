import { PERMISSION_MODULES, type PermissionModule } from "./permissions";
import type { Locale } from "@/i18n/config";

export type DashboardNavIcon =
  | "dashboard"
  | "users"
  | "contacts"
  | "reservations"
  | "accounting"
  | "logs"
  | "email"
  | "settings";

export interface DashboardNavItem {
  href: string;
  icon: DashboardNavIcon;
  labelKey: string;
  module?: PermissionModule;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    href: "/users",
    icon: "users",
    labelKey: "nav.users",
    module: PERMISSION_MODULES.USERS,
  },
  {
    href: "/contacts",
    icon: "contacts",
    labelKey: "nav.contacts",
    module: PERMISSION_MODULES.CONTACTS,
  },
  {
    href: "/reservations",
    icon: "reservations",
    labelKey: "nav.reservations",
    module: PERMISSION_MODULES.RESERVATIONS,
  },
  {
    href: "/accounting",
    icon: "accounting",
    labelKey: "nav.accounting",
    module: PERMISSION_MODULES.ACCOUNTING,
  },
  {
    href: "/logs",
    icon: "logs",
    labelKey: "nav.logs",
    module: PERMISSION_MODULES.LOGS,
  },
  {
    href: "/settings",
    icon: "settings",
    labelKey: "nav.settings",
    module: PERMISSION_MODULES.SETTINGS,
  },
  {
    href: "/email",
    icon: "email",
    labelKey: "nav.email",
    module: PERMISSION_MODULES.EMAIL,
  },
];

export const DASHBOARD_TITLE_KEYS: Array<[string, string]> = [
  ["/users", "users.title"],
  ["/contacts", "nav.contacts"],
  ["/reservations", "nav.reservations"],
  ["/accounting", "nav.accounting"],
  ["/logs", "nav.logs"],
  ["/settings", "settings.title"],
  ["/email", "nav.email"],
];

export function buildLocalizedDashboardHref(locale: Locale, href: string) {
  return `/${locale}${href}`;
}

export function isDashboardRouteActive(
  pathname: string,
  locale: Locale,
  href: string,
) {
  const target = buildLocalizedDashboardHref(locale, href);

  if (!href) {
    return pathname === target;
  }

  return pathname === target || pathname.startsWith(`${target}/`);
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo } from "react";

import { canAccessModule } from "@/config/access";
import {
  DASHBOARD_NAV_ITEMS,
  isDashboardRouteActive,
  type DashboardNavIcon,
} from "@/config/navigation";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { useAuth } from "@/modules/auth";
import {
  AccountingIcon,
  ContactsIcon,
  DashboardIcon,
  LogsIcon,
  ReservationsIcon,
  SettingsIcon,
  UsersIcon,
} from "./LayoutIcons";

const navIcons: Record<DashboardNavIcon, () => React.ReactNode> = {
  accounting: () => <AccountingIcon />,
  contacts: () => <ContactsIcon />,
  dashboard: () => <DashboardIcon />,
  logs: () => <LogsIcon />,
  reservations: () => <ReservationsIcon />,
  settings: () => <SettingsIcon />,
  users: () => <UsersIcon />,
};

export const BottomNav = memo(function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { role } = useAuth();

  const locale = pathname?.split("/")?.[1] || "en";

  const navItems = useMemo(() => {
    return DASHBOARD_NAV_ITEMS.filter((item) => {
      return !item.module || (role ? canAccessModule(role, item.module) : false);
    });
  }, [role]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#EAEAEA] bg-white lg:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        className="grid items-center px-1 py-2"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const href = `/${locale}${item.href}`;
          const active = isDashboardRouteActive(pathname, locale === "ar" ? "ar" : "en", item.href);

          return (
            <Link
              key={item.href || "dashboard"}
              href={href}
              className={`flex min-w-0 flex-col items-center justify-center px-1 py-1.5 transition-all duration-200 ${
                active ? "text-accent" : "text-[#787774] hover:text-[#1A1A1A]"
              }`}
            >
              <span className={active ? "text-accent" : "text-[#787774]"}>
                {navIcons[item.icon]()}
              </span>
              <span
                className={`mt-0.5 max-w-full truncate text-[11px] font-medium ${active ? "text-accent" : "text-[#787774]"}`}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});

export default BottomNav;

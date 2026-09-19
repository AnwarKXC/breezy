"use client";

import { memo, useCallback, useMemo, useState } from "react";

import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";

import { canAccessModule } from "@/config/access";
import {
  buildLocalizedDashboardHref,
  DASHBOARD_NAV_ITEMS,
  isDashboardRouteActive,
  type DashboardNavIcon,
} from "@/config/navigation";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { useAuth } from "@/modules/auth";
import type { Locale } from "@/i18n/config";
import {
  AccountingIcon,
  ContactsIcon,
  DashboardIcon,
  LogoutIcon,
  LogsIcon,
  ReservationsIcon,
  SettingsIcon,
  UsersIcon,
} from "./LayoutIcons";
import { SidebarNavLink } from "./SidebarNavLink";
import { SidebarSocialLinks } from "./SidebarSocialLinks";

const navIcons: Record<DashboardNavIcon, () => React.ReactNode> = {
  accounting: () => <AccountingIcon />,
  contacts: () => <ContactsIcon />,
  dashboard: () => <DashboardIcon />,
  logs: () => <LogsIcon />,
  reservations: () => <ReservationsIcon />,
  settings: () => <SettingsIcon />,
  users: () => <UsersIcon />,
};

function getLocaleParam(locale: string | string[] | undefined): Locale {
  return locale === "ar" ? "ar" : "en";
}

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ locale?: string | string[] }>();
  const { t } = useTranslation();
  const { loading, logout, role } = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const navItems = useMemo(() => {
    return DASHBOARD_NAV_ITEMS.filter((item) => {
      return !item.module || (role ? canAccessModule(role, item.module) : false);
    });
  }, [role]);
  const locale = getLocaleParam(params.locale);
  const localePrefix = `/${locale}`;

  const handleLogout = useCallback(async () => {
    setLogoutError(null);

    try {
      await logout();
      router.replace(`${localePrefix}/login`);
    } catch {
      setLogoutError(t("auth.errors.logoutFailed"));
    }
  }, [logout, localePrefix, router, t]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e border-line bg-white px-5 pb-6 text-ink lg:flex lg:min-h-full">
      <Link
        href={localePrefix}
        // Same height and bottom border as the top bar, so they read as one line.
        className="-mx-5 mb-6 flex h-16 shrink-0 items-center gap-3 border-b border-line px-7 text-base font-semibold tracking-tight text-ink"
      >
<span className="grid h-10 w-10 place-items-center">
  <Image
    alt={t("common.appName")}
    className="h-10 w-10 object-contain"
    src="/Full Logo Green.png"
    width={40}
    height={40}
  />
</span>
        <span className="min-w-0">
          <span className="block truncate">{t("common.appName")}</span>
          <span className="block truncate text-xs font-medium text-[#787774]">
            {t("layout.admin")}
          </span>
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5">
        <p className="px-4 pb-2 text-[10px] uppercase tracking-[0.08em] text-[#787774]">
          {t("layout.menu")}
        </p>
        {navItems.map((item) => {
          const href = buildLocalizedDashboardHref(locale, item.href);
          const isActive = isDashboardRouteActive(pathname, locale, item.href);

          return (
            <SidebarNavLink
              href={href}
              icon={navIcons[item.icon]()}
              isActive={isActive}
              key={item.href || "dashboard"}
              label={t(item.labelKey)}
            />
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#EAEAEA] pt-4">
        <SidebarSocialLinks />
        <button
          className="mt-1.5 flex h-10 w-full items-center gap-3 rounded-md px-4 text-sm font-medium text-[#787774] transition-colors duration-200 hover:bg-[#F5F5F5] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading}
          onClick={handleLogout}
          type="button"
        >
          <span className="grid h-5 w-5 place-items-center">
            <LogoutIcon />
          </span>
          <span>{loading ? t("layout.loggingOut") : t("layout.logout")}</span>
        </button>
        {logoutError ? (
          <p className="mt-2 px-4 text-xs font-semibold text-[#9F2F2D]">
            {logoutError}
          </p>
        ) : null}
      </div>
    </aside>
  );
});

export default Sidebar;

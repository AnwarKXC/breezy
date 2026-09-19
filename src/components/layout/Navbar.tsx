"use client";

import { memo, useMemo } from "react";
import { useParams, usePathname } from "next/navigation";


import { DASHBOARD_TITLE_KEYS } from "@/config/navigation";
import type { Locale } from "@/i18n/config";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { TopbarActions } from "./TopbarActions";

function getLocaleParam(locale: string | string[] | undefined): Locale {
  return locale === "ar" ? "ar" : "en";
}

export const Navbar = memo(function Navbar() {
  const pathname = usePathname();
  const params = useParams<{ locale?: string | string[] }>();
  const { t, isRTL } = useTranslation();
  const locale = getLocaleParam(params.locale);
  const localePrefix = `/${locale}`;

  const title = useMemo(() => {
    const pathWithoutLocale =
      pathname.replace(new RegExp(`^/${locale}`), "") || "/";
    const match = DASHBOARD_TITLE_KEYS.find(([segment]) => {
      return (
        pathWithoutLocale === segment ||
        pathWithoutLocale.startsWith(`${segment}/`)
      );
    });

    return t(match?.[1] ?? "dashboard.title");
  }, [locale, pathname, t]);

  return (
    <header className={`fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#EAEAEA] bg-white px-4 sm:px-6 lg:sticky lg:inset-auto lg:top-0 lg:w-full lg:px-8 ${isRTL ? "flex-row-reverse" : ""}`}>
      <div className={`flex min-w-0 items-center gap-3 ${isRTL ? "flex-row-reverse text-right" : ""}`}>
<span className="grid h-8 w-8 shrink-0 place-items-center">
  <img
    alt={t("common.appName")}
    className="h-8 w-8 object-contain"
    src="/logo Green.svg"
    width={32}
    height={32}
  />
</span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[#1A1A1A]">{t("common.appName")}</p>
          <p className="truncate text-xs font-medium text-[#787774]">{title}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <TopbarActions isRTL={isRTL} localePrefix={localePrefix} t={t} />
      </div>
    </header>
  );
});

export default Navbar;

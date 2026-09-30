"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { useParams, usePathname } from "next/navigation";

import { DASHBOARD_TITLE_KEYS } from "@/config/navigation";
import type { Locale } from "@/i18n/config";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { TopbarActions } from "./TopbarActions";
import { BrandLogo, useBranding } from "@/shared/branding/BrandingContext";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Crumb {
  label: string;
  href: string;
}

function getLocaleParam(locale: string | string[] | undefined): Locale {
  return locale === "ar" ? "ar" : "en";
}

/**
 * Pages above the current one. The current page is left out on purpose: every
 * page renders its own heading, so repeating it here would duplicate the title.
 */
function buildParentCrumbs(path: string, localePrefix: string, t: (key: string) => string): Crumb[] {
  const [section, sub, action] = path.split("/").filter(Boolean);
  if (!section || !sub) return [];

  const titleKey = DASHBOARD_TITLE_KEYS.find(([segment]) => segment === `/${section}`)?.[1];
  const sectionHref = `${localePrefix}/${section}`;
  const crumbs: Crumb[] = [{ label: t(titleKey ?? "dashboard.title"), href: sectionHref }];
  if (UUID_RE.test(sub) && action === "edit") {
    crumbs.push({ label: t("layout.breadcrumb.details"), href: `${sectionHref}/${sub}` });
  }
  return crumbs;
}

function BackIcon({ isRTL }: { isRTL: boolean }) {
  return (
    <svg aria-hidden="true" className={`h-4 w-4 shrink-0 ${isRTL ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export const Navbar = memo(function Navbar() {
  const pathname = usePathname();
  const params = useParams<{ locale?: string | string[] }>();
  const { t, isRTL } = useTranslation();
  const { displayName, hasCustomLogo } = useBranding();
  const locale = getLocaleParam(params.locale);
  const localePrefix = `/${locale}`;
  const parents = buildParentCrumbs(pathname.replace(new RegExp(`^/${locale}`), ""), localePrefix, t);

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-white px-4 sm:px-6 lg:sticky lg:inset-auto lg:top-0 lg:w-full lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {/* The sidebar carries the brand on desktop; show it here only on smaller screens. */}
        <Link href={localePrefix} className="shrink-0 lg:hidden" aria-label={displayName}>
          {hasCustomLogo ? (
            <BrandLogo size={32} className="h-8 w-8 object-contain" priority />
          ) : (
            <Image alt="" className="h-8 w-8 object-contain" src="/logo-mark.png" width={32} height={32} priority unoptimized />
          )}
        </Link>

        {parents.length > 0 && (
          <nav aria-label={t("layout.breadcrumb.label")} className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1.5 text-sm">
              {parents.map((crumb, index) => (
                <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
                  {index === 0 ? <BackIcon isRTL={isRTL} /> : <span aria-hidden="true" className="text-ink-muted/50">/</span>}
                  <Link href={crumb.href} className="truncate font-medium text-ink-muted transition-colors hover:text-ink">
                    {crumb.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <TopbarActions localePrefix={localePrefix} t={t} />
      </div>
    </header>
  );
});

export default Navbar;

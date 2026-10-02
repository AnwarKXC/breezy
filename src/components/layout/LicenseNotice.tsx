"use client";

import { useTranslation } from "@/i18n/hooks/useTranslation";

export interface LicenseNoticeProps {
  readOnly: boolean;
  /** Grace end (ISO); when writes will be blocked. */
  readOnlyAt: string | null;
  /** Paused by the provider (read-only on purpose), not an expired subscription. */
  suspended?: boolean;
}

export function LicenseNotice({ readOnly, readOnlyAt, suspended = false }: LicenseNoticeProps) {
  const { t, locale } = useTranslation();
  const date = readOnlyAt ? new Date(readOnlyAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") : "";

  return (
    <div
      role="status"
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        readOnly ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {suspended
        ? t("layout.license.suspended")
        : readOnly
          ? t("layout.license.readOnly")
          : t("layout.license.grace").replace("{date}", date)}
    </div>
  );
}

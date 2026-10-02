"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/i18n/hooks/useTranslation";

export interface LicenseNoticeProps {
  readOnly: boolean;
  /** Grace end (ISO); when writes will be blocked. */
  readOnlyAt: string | null;
  /** Paused by the provider (read-only on purpose), not an expired subscription. */
  suspended?: boolean;
  /** Active but inside the provider-set warning window: show a countdown to `expiresAt`. */
  expiring?: boolean;
  expiresAt?: string | null;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** "in 4 days" / "خلال 4 أيام"; hours on the last day. Re-rendered every minute. */
function useCountdown(target: string | null | undefined, locale: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!target) return "";
  const left = new Date(target).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", { numeric: "always" });
  return left >= DAY_MS ? rtf.format(Math.floor(left / DAY_MS), "day") : rtf.format(Math.max(1, Math.ceil(left / HOUR_MS)), "hour");
}

export function LicenseNotice({ readOnly, readOnlyAt, suspended = false, expiring = false, expiresAt = null }: LicenseNoticeProps) {
  const { t, locale } = useTranslation();
  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB") : "");
  const countdown = useCountdown(expiring ? expiresAt : null, locale);

  const message = suspended
    ? t("layout.license.suspended")
    : readOnly
      ? t("layout.license.readOnly")
      : expiring
        ? t("layout.license.expiring").replace("{countdown}", countdown).replace("{date}", formatDate(expiresAt))
        : t("layout.license.grace").replace("{date}", formatDate(readOnlyAt));

  return (
    <div
      role="status"
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        readOnly ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      {message}
    </div>
  );
}

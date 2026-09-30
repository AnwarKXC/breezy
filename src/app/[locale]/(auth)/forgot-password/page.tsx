"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";

import { useTranslation } from "@/i18n/hooks/useTranslation";
import { FloatingInput } from "@/shared/components/FloatingField";
import { AuthCard, authButtonClass, authErrorClass, authLinkClass } from "../AuthCard";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const params = useParams<{ locale?: string }>();
  const locale = params.locale === "ar" ? "ar" : "en";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "rate_limited">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      setStatus(response.ok ? "sent" : response.status === 429 ? "rate_limited" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <AuthCard title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
      {status === "sent" ? (
        <p className="rounded-lg bg-[#F5F5F5] px-3 py-3 text-xs font-medium text-[#1A1A1A]">{t("auth.forgot.sent")}</p>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <FloatingInput
            disabled={status === "sending"}
            label={t("auth.login.email")}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {status === "error" || status === "rate_limited" ? (
            <p className={authErrorClass}>
              {t(status === "rate_limited" ? "auth.errors.rateLimited" : "auth.errors.requestFailed")}
            </p>
          ) : null}
          <button className={authButtonClass} disabled={status === "sending"} type="submit">
            {status === "sending" ? t("auth.forgot.sending") : t("auth.forgot.submit")}
          </button>
        </form>
      )}
      <Link className={`mt-4 ${authLinkClass}`} href={`/${locale}/login`}>
        {t("auth.forgot.backToLogin")}
      </Link>
    </AuthCard>
  );
}

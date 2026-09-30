"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { useTranslation } from "@/i18n/hooks/useTranslation";
import { FloatingInput } from "@/shared/components/FloatingField";
import { AuthCard, authButtonClass, authErrorClass, authLinkClass } from "../AuthCard";

const MIN_PASSWORD_LENGTH = 8;

type ErrorKey = "passwordTooShort" | "passwordMismatch" | "invalidResetLink" | "rateLimited" | "requestFailed";

export function ResetPasswordForm({ token, locale }: { token: string; locale: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(token ? null : "invalidResetLink");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (password.length < MIN_PASSWORD_LENGTH) return setError("passwordTooShort");
    if (password !== confirm) return setError("passwordMismatch");

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (response.ok) {
        setDone(true);
        return;
      }
      setError(response.status === 400 ? "invalidResetLink" : response.status === 429 ? "rateLimited" : "requestFailed");
    } catch {
      setError("requestFailed");
    }
    setSubmitting(false);
  }

  const disabled = submitting || !token;

  if (done) {
    return (
      <AuthCard title={t("auth.reset.title")} subtitle={t("auth.reset.subtitle")}>
        <p className="rounded-lg bg-[#F5F5F5] px-3 py-3 text-xs font-medium text-[#1A1A1A]">{t("auth.reset.done")}</p>
        <Link className={authButtonClass + " flex items-center justify-center"} href={`/${locale}/login`}>
          {t("auth.login.submit")}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.reset.title")} subtitle={t("auth.reset.subtitle")}>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <FloatingInput
          autoComplete="new-password"
          disabled={disabled}
          label={t("auth.reset.password")}
          minLength={MIN_PASSWORD_LENGTH}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <FloatingInput
          autoComplete="new-password"
          disabled={disabled}
          label={t("auth.reset.confirmPassword")}
          name="confirmPassword"
          onChange={(event) => setConfirm(event.target.value)}
          required
          type="password"
          value={confirm}
        />
        {error ? <p className={authErrorClass}>{t(`auth.errors.${error}`)}</p> : null}
        <button className={authButtonClass} disabled={disabled} type="submit">
          {submitting ? t("auth.reset.saving") : t("auth.reset.submit")}
        </button>
      </form>
      <Link
        className={`mt-4 ${authLinkClass}`}
        href={error === "invalidResetLink" ? `/${locale}/forgot-password` : `/${locale}/login`}
      >
        {error === "invalidResetLink" ? t("auth.reset.requestNewLink") : t("auth.forgot.backToLogin")}
      </Link>
    </AuthCard>
  );
}

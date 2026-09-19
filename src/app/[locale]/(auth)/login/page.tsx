"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useTranslation } from "@/i18n/hooks/useTranslation";
import { useAuth } from "@/modules/auth";
import { FloatingInput } from "@/shared/components/FloatingField";
import { selectBlockedUntil } from "@/store/authSlice";
import { useAppSelector } from "@/store/hooks";
import type { AuthServiceErrorCode } from "@/services/auth";
import type { Locale } from "@/i18n/config";

const authErrorKeys: Record<AuthServiceErrorCode, string> = {
  "auth/invalid_credentials": "auth.errors.invalidCredentials",
  "auth/invalid_role": "auth.errors.invalidRole",
  "auth/login_failed": "auth.errors.loginFailed",
  "auth/logout_failed": "auth.errors.logoutFailed",
  "auth/role_fetch_failed": "auth.errors.roleFetchFailed",
  "auth/session_failed": "auth.errors.sessionFailed",
  "auth/user_not_found": "auth.errors.userNotFound",
};

function getLocaleParam(locale: string | string[] | undefined): Locale {
  return locale === "ar" ? "ar" : "en";
}

export default function LoginPage() {
  const router = useRouter();
  const params = useParams<{ locale?: string | string[] }>();
  const { t } = useTranslation();
  const { login, loading, error, clearError } = useAuth();
  const blockedUntil = useAppSelector(selectBlockedUntil);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remaining, setRemaining] = useState(0);
  const submittingRef = useRef(false);
  const locale = useMemo(() => getLocaleParam(params.locale), [params.locale]);
  const errorMessage = error ? t(authErrorKeys[error]) : null;
  const blocked = remaining > 0;

  // Countdown ticks come from timers (never synchronously in the effect body).
  useEffect(() => {
    const tick = () => {
      const left = blockedUntil ? Math.ceil((blockedUntil - Date.now()) / 1000) : 0;
      setRemaining(Math.max(0, left));
      if (left <= 0) clearInterval(id);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [blockedUntil]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || submittingRef.current) return;
    submittingRef.current = true;
    clearError();

    try {
      await login({ email, password });
      router.replace(`/${locale}/reservations`);
    } catch {
      // Error is surfaced via the `error` state from useAuth.
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <main className="min-h-screen bg-[#d6d6d4] text-[#111111]">
      <section className="grid min-h-screen w-full overflow-hidden bg-white lg:grid-cols-[1fr_1.04fr]">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10 sm:px-12">
          <div className="w-full max-w-[320px]">
            <div className="mb-8 text-center">
              <img
                alt="Breezy System"
                className="mx-auto mb-5 h-20 w-20 object-contain"
                src="/Full Logo Green.png"
                width={80}
                height={80}
              />
              <h1 className="text-2xl font-bold tracking-tight">
                {t("auth.login.title")}
              </h1>
              <p className="mt-1 text-xs font-medium text-[#787774]">
                {t("auth.login.subtitle")}
              </p>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                  <FloatingInput
                    autoComplete="email"
                    disabled={loading || blocked}
                    label={t("auth.login.email")}
                    name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </div>

              <div>
                  <FloatingInput
                    autoComplete="current-password"
                    disabled={loading || blocked}
                    label={t("auth.login.password")}
                    name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </div>

              {errorMessage ? (
                <p className="bg-[#F5F5F5] px-3 py-2 text-xs font-bold text-[#9F2F2D]">
                  {errorMessage}
                </p>
              ) : null}

              <button
                className="mt-2 h-11 w-full rounded-lg bg-[#1A1A1A] px-4 text-xs font-bold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={loading || blocked}
                type="submit"
              >
                {loading
                  ? t("auth.login.loading")
                  : blocked
                    ? `${t("auth.login.blocked")} ${remaining}s`
                    : t("auth.login.submit")}
              </button>
            </form>
          </div>

          <div className="mt-8 flex flex-col items-center gap-2 lg:hidden">
            <p className="text-xs text-[#787774]">Powered by Stepcreative.eg</p>
            <img
              src="/logo-without-text-removebg-preview.png"
              alt="Logo"
              className="h-18 w-18 object-contain"
            />
          </div>
        </div>

        <aside className="hidden min-h-screen flex-col items-center justify-center bg-[#1A1A1A] lg:flex">
          <Image
            alt="Logo"
            className="h-40 w-40 object-contain sm:h-52 sm:w-52 [filter:brightness(0)_invert(1)]"
            height={208}
            priority
            src="/logo-without-text-removebg-preview.png"
            width={208}
          />
          <p className="mt-6 text-xs font-medium tracking-wider text-[#787774]">
            Powered by Step.eg
          </p>
        </aside>
      </section>
    </main>
  );
}

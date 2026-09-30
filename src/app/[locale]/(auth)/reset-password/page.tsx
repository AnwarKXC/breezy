import type { Metadata } from "next";

import { ResetPasswordForm } from "./ResetPasswordForm";

// The URL carries the reset token; never send it to other origins.
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);
  return <ResetPasswordForm locale={locale === "ar" ? "ar" : "en"} token={typeof token === "string" ? token : ""} />;
}

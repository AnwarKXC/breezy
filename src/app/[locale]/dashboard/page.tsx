import { redirect } from "next/navigation";

export default async function DashboardRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/reservations`);
}

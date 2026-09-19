import dynamic from "next/dynamic";
import { PERMISSION_MODULES } from "@/config/rbac";
import { checkLocale } from "@/i18n/config";
import { enforceModuleAccess } from "@/shared/rbac/requireModuleAccess";
import { PageSkeleton } from "@/shared/components/PageSkeleton";

const YearOverviewPage = dynamic(
  () => import("@/modules/reservations/components/YearOverviewPage").then((m) => ({ default: m.YearOverviewPage })),
  { loading: () => <PageSkeleton /> }
);

export default async function ReservationsYearViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = checkLocale(rawLocale);
  await enforceModuleAccess(PERMISSION_MODULES.RESERVATIONS, locale, `/${locale}/reservations`);

  return <YearOverviewPage />;
}

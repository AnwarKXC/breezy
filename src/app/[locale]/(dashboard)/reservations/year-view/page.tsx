import { YearOverviewPage } from '@/modules/reservations/components/YearOverviewPage'
import { PERMISSION_MODULES } from "@/config/rbac";
import { checkLocale } from "@/i18n/config";
import { enforceModuleAccess } from "@/shared/rbac/requireModuleAccess";
export default async function ReservationsYearViewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = checkLocale(rawLocale);
  await enforceModuleAccess(PERMISSION_MODULES.RESERVATIONS, locale, `/${locale}/reservations`);

  return <YearOverviewPage />;
}

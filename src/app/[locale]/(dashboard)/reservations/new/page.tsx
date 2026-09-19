import { checkLocale } from "@/i18n/config";
import { ACTIONS } from "@/config/rbac";
import { enforceActionAccess } from "@/shared/rbac/requireModuleAccess";
import { NewReservationPage } from '@/modules/reservations/components/NewReservationPage'

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = checkLocale(rawLocale);
  await enforceActionAccess(ACTIONS.RESERVATIONS_CREATE, locale, `/${locale}/reservations/new`);

  return <NewReservationPage />;
}

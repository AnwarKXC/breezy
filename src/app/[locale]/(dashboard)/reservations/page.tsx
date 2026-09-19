import dynamic from "next/dynamic";
import { PERMISSION_MODULES } from "@/config/rbac";
import { checkLocale } from "@/i18n/config";
import { enforceModuleAccess } from "@/shared/rbac/requireModuleAccess";
import { PageSkeleton } from "@/shared/components/PageSkeleton";

const BookingsPage = dynamic(
  () => import("@/modules/bookings/components/BookingsPage").then((m) => ({ default: m.BookingsPage })),
  { loading: () => <PageSkeleton /> }
);

export default async function ReservationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = checkLocale(rawLocale);
  await enforceModuleAccess(PERMISSION_MODULES.RESERVATIONS, locale, `/${locale}/reservations`);

  return <BookingsPage />;
}

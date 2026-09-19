import { checkLocale } from "@/i18n/config";
import { ACTIONS } from "@/config/rbac";
import { enforceActionAccess } from "@/shared/rbac/requireModuleAccess";
import dynamic from "next/dynamic";

const NewReservationPage = dynamic(() => import("@/modules/reservations/components/NewReservationPage").then(m => m.NewReservationPage), {
  loading: () => <PageSkeleton />,
});

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F6F3] px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded bg-[#EAEAEA]" />
        <div className="h-64 rounded-xl bg-white" />
      </div>
    </div>
  )
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = checkLocale(rawLocale);
  await enforceActionAccess(ACTIONS.RESERVATIONS_CREATE, locale, `/${locale}/reservations/new`);

  return <NewReservationPage />;
}

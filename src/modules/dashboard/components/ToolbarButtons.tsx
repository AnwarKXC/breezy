import { memo } from "react";
import { AOS } from "@/shared/components/AOS";
import type { Translate } from "./dashboard-types";

export const DashboardHeader = memo(function DashboardHeader({ t, welcome }: { t: Translate; welcome: string }) {
  return (
    <AOS animation="fade-up">
      <header className="mb-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-medium uppercase text-[#787774]">
              {t("dashboard.eyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1A1A1A]">
              {welcome}
            </h1>
            <p className="mt-1 text-sm font-medium text-[#787774]">{t("dashboard.subtitle")}</p>
          </div>
          <div className="flex max-w-sm items-center gap-3 rounded-xl border border-[#EAEAEA] bg-white px-4 py-3 text-sm text-[#787774]">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#F5F5F5] text-[#1A1A1A]">
              {t("layout.brandMark")}
            </span>
            <span className="truncate">{t("dashboard.overallInformation")}</span>
          </div>
        </div>
      </header>
    </AOS>
  );
});

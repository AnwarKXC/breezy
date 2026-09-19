import { memo } from "react";
import { AOS } from "@/shared/components/AOS";
import type { DashboardMetricView } from "./dashboard-types";

export const OverviewCard = memo(function OverviewCard({ metrics }: { metrics: DashboardMetricView[] }) {
  return (
    <AOS animation="fade-up">
      <section className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
        {metrics.map((item, index) => {
          return (
            <div
              key={item.id}
              className="rounded-xl border border-[#EAEAEA] bg-white p-4 text-[#1A1A1A]"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-[#555555]">
                  {item.label}
                </p>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#F5F5F5] text-xs font-medium text-[#787774]">
                  {index + 1}
                </span>
              </div>
              <p className="mt-5 text-2xl font-semibold tracking-tight">{item.value}</p>
              <p className="mt-2 text-xs text-[#346538]">
                +3.16% {item.helper}
              </p>
            </div>
          );
        })}
      </section>
    </AOS>
  );
});

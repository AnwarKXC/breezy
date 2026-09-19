import { memo } from "react";
import { AOS } from "@/shared/components/AOS";
import type { DashboardGoalView } from "./dashboard-types";

export const GoalsCard = memo(function GoalsCard({ goals, title }: { goals: DashboardGoalView[]; title: string }) {
  return (
    <AOS animation="fade-up">
      <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#1A1A1A]">{title}</h2>
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#EAEAEA] bg-[#F9F9F8] text-[10px] font-medium">1/4</span>
        </div>
        <div className="space-y-4">
          {goals.map((goal) => (
            <label key={goal.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${goal.done ? "bg-[#1A1A1A] font-medium text-white" : "bg-[#F9F9F8] text-[#787774]"}`}>
              <span className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${goal.done ? "border-[#1A1A1A] bg-[#1A1A1A] text-white" : "border-[#D4D4D4] bg-white"}`}>
                {goal.done ? "x" : ""}
              </span>
              {goal.label}
            </label>
          ))}
        </div>
      </section>
    </AOS>
  );
});

import { memo } from "react";
import { AOS } from "@/shared/components/AOS";
import type { DashboardTaskView, Translate } from "./dashboard-types";

function NoteMenu({ t }: { t: Translate }) {
  return (
    <div className="absolute -top-14 right-4 hidden rounded-xl border border-[#EAEAEA] bg-white px-3 py-2 text-xs text-[#333333]  xl:block">
      <p className="py-0.5">{t("dashboard.pinNote")}</p>
      <p className="py-0.5">{t("common.edit")}</p>
      <p className="py-0.5">{t("common.delete")}</p>
    </div>
  );
}

export const TaskCards = memo(function TaskCards({ tasks, t }: { tasks: DashboardTaskView[]; t: Translate }) {
  return (
    <AOS animation="fade-up" delay={100}>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A]">{t("dashboard.taskInProcess")}</h2>
          <a className="rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-xs font-medium text-[#555555]" href="#">{t("dashboard.openArchive")}</a>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {tasks.map((task, index) => (
            <article key={task.id} className="relative rounded-xl border border-[#EAEAEA] bg-white p-5">
              {index === 1 ? <NoteMenu t={t} /> : null}
              <div className="mb-7 flex justify-between text-xl"><span>{task.rotated ? "[]" : "+"}</span><span>...</span></div>
              <h3 className="text-lg font-bold leading-tight text-[#1A1A1A]">{task.title}</h3>
              <p className="mt-7 text-xs text-[#787774]">{task.dateLabel}</p>
            </article>
          ))}
          <button type="button" className="grid min-h-40 place-items-center rounded-xl border border-dashed border-[#D4D4D4] bg-white p-5 text-lg font-semibold text-[#1A1A1A] transition-all duration-200 hover:border-[#1A1A1A]">
            + {t("dashboard.addTask")}
          </button>
        </div>
      </section>
    </AOS>
  );
});

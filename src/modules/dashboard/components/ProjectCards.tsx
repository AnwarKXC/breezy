import { memo, useMemo } from "react";
import { AOS } from "@/shared/components/AOS";
import { Table, TableActionsMenu, type TableColumn } from "@/shared/table";
import type { DashboardProjectView, Translate } from "./dashboard-types";

function SortControls({ t }: { t: Translate }) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-[#555555]">
      <span>{t("dashboard.sortBy")}</span>
      <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#EAEAEA] bg-white text-[#787774]" aria-hidden="true">#</span>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#1A1A1A] text-white" aria-hidden="true">=</span>
    </div>
  );
}

export const ProjectCards = memo(function ProjectCards({ projects, t, title }: { projects: DashboardProjectView[]; t: Translate; title: string }) {
  const columns = useMemo<TableColumn<DashboardProjectView & Record<string, unknown>>[]>(() => [
    {
      key: "title",
      label: t("dashboard.taskInProcess"),
      render: (_value, project) => (
        <div>
          <p className="font-bold text-[#1A1A1A]">{project.title}</p>
          <p className="mt-1 max-w-md truncate text-xs text-[#787774]">{project.summary}</p>
        </div>
      ),
    },
    {
      key: "status",
      label: t("dashboard.overallInformation"),
      render: (_value, project) => (
        <span className="inline-flex items-center gap-2 rounded-full bg-[#F9F9F8] px-3 py-1 text-xs font-bold text-[#346538]">
          <span className="h-2 w-2 rounded-full bg-[#EDF3EC]0" />
          {project.status}
        </span>
      ),
    },
    {
      key: "step",
      label: t("dashboard.monthProgress"),
      render: (_value, project) => (
        <span className="font-bold text-[#1A1A1A]">{project.step}</span>
      ),
    },
    {
      key: "id",
      label: t("users.actions"),
      render: () => (
        <TableActionsMenu
          actions={[
            { label: t("common.edit"), onSelect: () => undefined },
            { destructive: true, label: t("common.delete"), onSelect: () => undefined },
          ]}
          ariaLabel={t("users.actions")}
        />
      ),
    },
  ], [t]);

  return (
    <AOS animation="fade-up" delay={200}>
      <section className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-[#1A1A1A]">{title}</h2>
          <SortControls t={t} />
        </div>
        <Table
          columns={columns}
          data={projects as Array<DashboardProjectView & Record<string, unknown>>}
          paginate={false}
          sortable={false}
        />
      </section>
    </AOS>
  );
});

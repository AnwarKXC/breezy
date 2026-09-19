"use client";

import { useTranslation } from "@/i18n/hooks/useTranslation";
import { useAuth } from "@/modules/auth/hooks";
import {
  DashboardHeader,
  GoalsCard,
  MonthProgress,
  OverviewCard,
  ProjectCards,
  TaskCards,
  WeeklyProgress,
} from "./components";
import { useDashboardOverview } from "./hooks";

function getAccountName(user: { displayName: string | null; email: string | null } | null) {
  const displayName = user?.displayName?.trim();
  if (displayName) return displayName;

  return user?.email?.split("@")[0] ?? null;
}

export function DashboardPage() {
  const { goals, metrics, projects, tasks, loading } = useDashboardOverview();
  const { user } = useAuth();
  const { t } = useTranslation();
  const accountName = getAccountName(user) ?? t("layout.admin");
  const welcome = `${t("dashboard.welcome")} ${accountName}!`;

  if (loading && !projects.length) {
    return (
      <main className="overflow-hidden">
        <div className="mx-auto w-full">
          <div className="h-96 animate-pulse rounded-xl bg-[#F5F5F5]" />
        </div>
      </main>
    );
  }

  return (
    <main className="overflow-hidden">
      <div className="mx-auto w-full">
        <DashboardHeader t={t} welcome={welcome} />

        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr_0.9fr]">
          <OverviewCard metrics={metrics} />
          <WeeklyProgress t={t} title={t("dashboard.weeklyProgress")} />
          <MonthProgress t={t} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_2.15fr]">
          <GoalsCard goals={goals} title={t("dashboard.monthGoals")} />
          <TaskCards tasks={tasks} t={t} />
        </div>

        <div className="mt-7">
          <ProjectCards
            projects={projects}
            t={t}
            title={t("dashboard.lastProjects")}
          />
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import {
  fetchDashboard,
  selectDashboardData,
  selectDashboardLoading,
} from "../store";
import type { DashboardMetricView, DashboardProjectView, DashboardGoalView, DashboardTaskView } from "../components/dashboard-types";
import { DASHBOARD_METRICS, DASHBOARD_PROJECTS, DASHBOARD_GOALS, DASHBOARD_TASKS } from "@/data/dashboard.data";
import { localize } from "@/data/types";

export function useDashboardOverview() {
  const dispatch = useAppDispatch();
  const { locale } = useTranslation();
  const apiData = useAppSelector(selectDashboardData);
  const loading = useAppSelector(selectDashboardLoading);

  useEffect(() => {
    if (!apiData) {
      void dispatch(fetchDashboard()).catch(() => undefined);
    }
  }, [apiData, dispatch]);

  return useMemo(() => {
    const metrics: DashboardMetricView[] = apiData
      ? [
          { id: "rooms", label: DASHBOARD_METRICS[0].label.en, value: String(apiData.availableRooms), helper: DASHBOARD_METRICS[0].helper.en },
          { id: "in-progress", label: DASHBOARD_METRICS[1].label.en, value: String(apiData.activeBookings), helper: DASHBOARD_METRICS[1].helper.en },
          { id: "completed", label: DASHBOARD_METRICS[2].label.en, value: `${apiData.occupancyRate}%`, helper: DASHBOARD_METRICS[2].helper.en },
        ]
      : DASHBOARD_METRICS.map((m) => ({
          id: m.id,
          label: localize(m.label, locale),
          value: m.value,
          helper: localize(m.helper, locale),
        }));

    const projects: DashboardProjectView[] = DASHBOARD_PROJECTS.map((p) => ({
      id: p.id,
      title: localize(p.title, locale),
      status: localize(p.status, locale),
      summary: localize(p.summary, locale),
      step: p.step,
    }));

    const goals: DashboardGoalView[] = DASHBOARD_GOALS.map((g) => ({
      id: g.id,
      label: localize(g.label, locale),
      done: g.done,
    }));

    const tasks: DashboardTaskView[] = DASHBOARD_TASKS.map((t) => ({
      id: t.id,
      title: localize(t.title, locale),
      dateLabel: localize(t.dateLabel, locale),
      rotated: t.rotated,
    }));

    return { metrics, projects, goals, tasks, loading };
  }, [apiData, locale, loading]);
}

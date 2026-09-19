import type { Locale } from "@/i18n/config";
import { DASHBOARD_GOALS, DASHBOARD_METRICS, DASHBOARD_PROJECTS, DASHBOARD_TASKS } from "./dashboard.data";
import { localize } from "./types";

const overviewCache = new Map<Locale, ReturnType<typeof buildDashboardOverview>>();

function buildDashboardOverview() {
  const dataLocale = "en";

  return {
    metrics: DASHBOARD_METRICS.map((metric) => ({
      id: metric.id,
      label: localize(metric.label, dataLocale),
      value: metric.value,
      helper: localize(metric.helper, dataLocale),
    })),
    projects: DASHBOARD_PROJECTS.map((project) => ({
      id: project.id,
      title: localize(project.title, dataLocale),
      status: localize(project.status, dataLocale),
      summary: localize(project.summary, dataLocale),
      step: project.step,
    })),
    goals: DASHBOARD_GOALS.map((goal) => ({
      id: goal.id,
      label: localize(goal.label, dataLocale),
      done: goal.done,
    })),
    tasks: DASHBOARD_TASKS.map((task) => ({
      id: task.id,
      title: localize(task.title, dataLocale),
      dateLabel: localize(task.dateLabel, dataLocale),
      rotated: task.rotated,
    })),
  };
}

export function getDashboardOverview(locale: Locale) {
  const cached = overviewCache.get(locale);
  if (cached) return cached;

  const overview = buildDashboardOverview();
  overviewCache.set(locale, overview);

  return overview;
}

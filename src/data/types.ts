import type { Locale } from "@/i18n/config";

export interface LocalizedString {
  en: string;
  ar: string;
}

export function localize(value: LocalizedString, locale: Locale) {
  return value[locale] ?? value.en;
}

export interface DashboardMetric {
  id: string;
  label: LocalizedString;
  value: string;
  helper: LocalizedString;
}

export interface DashboardProject {
  id: string;
  title: LocalizedString;
  status: LocalizedString;
  summary: LocalizedString;
  step: string;
}

export interface DashboardGoal {
  id: string;
  label: LocalizedString;
  done: boolean;
}

export interface DashboardTask {
  id: string;
  title: LocalizedString;
  dateLabel: LocalizedString;
  rotated?: boolean;
}

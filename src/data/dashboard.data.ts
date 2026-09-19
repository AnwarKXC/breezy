import type { DashboardGoal, DashboardMetric, DashboardProject, DashboardTask } from "./types";

export const DASHBOARD_METRICS: DashboardMetric[] = [
  {
    id: "rooms",
    label: { en: "Rooms", ar: "الغرف" },
    value: "28",
    helper: { en: "available", ar: "متاحة" },
  },
  {
    id: "in-progress",
    label: { en: "In Progress", ar: "قيد التنفيذ" },
    value: "14",
    helper: { en: "service tasks", ar: "مهام خدمة" },
  },
  {
    id: "completed",
    label: { en: "Completed", ar: "مكتملة" },
    value: "11",
    helper: { en: "today", ar: "اليوم" },
  },
];

export const DASHBOARD_PROJECTS: DashboardProject[] = [
  {
    id: "schedule",
    title: { en: "New Schedule", ar: "جدول جديد" },
    status: { en: "In progress", ar: "قيد التنفيذ" },
    summary: {
      en: "Front desk rota, arrivals plan, housekeeping notes.",
      ar: "مناوبة الاستقبال، خطة الوصول، وملاحظات التدبير.",
    },
    step: "3/6",
  },
  {
    id: "prototype",
    title: { en: "Prototype animation", ar: "نموذج الحركة" },
    status: { en: "Completed", ar: "مكتمل" },
    summary: {
      en: "Guest journey screens and motion polish.",
      ar: "شاشات رحلة الضيف وتحسين الحركة.",
    },
    step: "1/1",
  },
  {
    id: "forecast",
    title: { en: "AI Project 2 part", ar: "مشروع الذكاء الثاني" },
    status: { en: "In progress", ar: "قيد التنفيذ" },
    summary: {
      en: "Forecasting occupancy and rate changes.",
      ar: "توقع الإشغال وتغير الأسعار.",
    },
    step: "2/8",
  },
];

export const DASHBOARD_GOALS: DashboardGoal[] = [
  { id: "vip-arrivals", label: { en: "Review VIP arrivals", ar: "مراجعة وصول كبار الضيوف" }, done: true },
  { id: "airport-pickups", label: { en: "Confirm airport pickups", ar: "تأكيد الاستقبال من المطار" }, done: false },
  { id: "minibar-audit", label: { en: "Close minibar audit", ar: "إغلاق مراجعة الميني بار" }, done: false },
  { id: "night-report", label: { en: "Print night report", ar: "طباعة تقرير الليل" }, done: false },
];

export const DASHBOARD_TASKS: DashboardTask[] = [
  {
    id: "gift",
    title: { en: "Buy Susan a gift for Birthday", ar: "شراء هدية لسوزان في عيد ميلادها" },
    dateLabel: { en: "Today", ar: "اليوم" },
    rotated: true,
  },
  {
    id: "doctor",
    title: { en: "Doctor's appointment on Tuesday", ar: "موعد الطبيب يوم الثلاثاء" },
    dateLabel: { en: "02.09.2026", ar: "02.09.2026" },
  },
];

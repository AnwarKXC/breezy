import { memo } from "react";
import { AOS } from "@/shared/components/AOS";
import type { Translate } from "./dashboard-types";

export const WeeklyProgress = memo(function WeeklyProgress({ t, title }: { t: Translate; title: string }) {
  return (
    <AOS animation="fade-up" delay={100}>
      <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1A1A1A]">{title}</h2>
            <div className="mt-3 flex gap-4 text-xs font-medium text-[#787774]">
              <span className="flex items-center gap-2 text-[#1A1A1A]"><span className="h-2 w-2 rounded-full bg-[#1A1A1A]" />{t("dashboard.income")}</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#D4D4D4]" />{t("dashboard.expenses")}</span>
            </div>
          </div>
          <span className="rounded-xl border border-[#EAEAEA] bg-[#F9F9F8] px-3 py-2 text-xs font-bold">24%</span>
        </div>
        <svg className="mt-6 h-44 w-full" viewBox="0 0 280 150" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="salesLine" x1="8" x2="272" y1="58" y2="58">
              <stop stopColor="#111111" />
              <stop offset="1" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <path d="M8 118H272M8 80H272M8 42H272" stroke="#E8E8E8" />
          <path d="M8 58C34 98 54 100 82 74C111 46 122 48 150 56C178 64 188 88 210 58C232 28 247 16 272 58" stroke="url(#salesLine)" strokeWidth="3" strokeLinecap="round" />
          <path d="M8 96C32 82 48 70 72 86C96 102 116 90 140 78C164 66 180 96 202 106C224 116 238 74 272 68" stroke="#8DB2D8" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div className="mt-1 grid grid-cols-7 text-center text-xs font-medium text-[#333333]">
          {["dashboard.dayMon", "dashboard.dayTue", "dashboard.dayWed", "dashboard.dayThu", "dashboard.dayFri", "dashboard.daySat", "dashboard.daySun"].map((day, index) => (
            <span key={day} className={index === 5 ? "mx-auto grid h-7 w-7 place-items-center rounded-full bg-[#1A1A1A] text-white" : ""}>{t(day)}</span>
          ))}
        </div>
      </section>
    </AOS>
  );
});

export const MonthProgress = memo(function MonthProgress({ t }: { t: Translate }) {
  return (
    <AOS animation="fade-up" delay={200}>
      <section className="rounded-xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="text-base font-bold text-[#1A1A1A]">{t("dashboard.monthProgress")}</h2>
        <p className="mt-2 text-xs font-medium text-[#1A1A1A]">+20% <span className="font-medium text-[#787774]">{t("dashboard.comparedLastMonth")}</span></p>
        <div className="mt-5 grid grid-cols-[1fr_128px] items-center gap-4">
          <div className="space-y-3 text-sm text-[#333333]">
            {["dashboard.balance", "dashboard.income", "dashboard.savings"].map((item, index) => (
              <p key={item} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[#1A1A1A]" : "bg-[#D4D4D4]"}`} />{t(item)}</p>
            ))}
          </div>
          <div className="grid h-32 w-32 place-items-center rounded-full border-[10px] border-[#111111] bg-[#F9F9F8]">
            <div className="grid h-24 w-24 place-items-center rounded-full border-[8px] border-[#EAEAEA] bg-white text-center"><span className="text-lg font-bold leading-none">120%</span></div>
          </div>
        </div>
        <button type="button" className="mt-6 h-10 w-full rounded-lg border border-[#1A1A1A] bg-white px-4 text-sm font-medium text-[#1A1A1A] transition-all duration-200 hover:bg-[#1A1A1A] hover:text-white">{t("dashboard.downloadReport")}</button>
      </section>
    </AOS>
  );
});

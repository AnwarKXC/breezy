import type { ReactNode } from "react";
import { InfoHint } from "./InfoHint";

interface AnalyticsCardProps {
  label: string;
  value: ReactNode;
  trend?: string;
  negative?: boolean;
  /** Optional explanation of what the number means, shown via an info badge. */
  hint?: string;
  accent?: 'indigo' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';
}

export function AnalyticsCard({ label, value, trend, negative, hint }: AnalyticsCardProps) {
  return (
    <article className="rounded-xl border border-line border-t-2 border-t-accent bg-accent/10 p-4 sm:p-6">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#787774]">
        <span className="min-w-0 truncate">{label}</span>
        {hint ? <InfoHint text={hint} /> : null}
      </p>
      <p className="mt-2 break-words text-2xl font-bold tracking-tight tabular-nums text-accent-ink sm:text-4xl">{value}</p>
      {trend ? (
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${negative ? "text-[#9F2F2D]" : "text-[#346538]"}`}>
          <span aria-hidden="true">{negative ? "▼" : "▲"}</span>
          <span>{trend}</span>
        </p>
      ) : null}
    </article>
  );
}

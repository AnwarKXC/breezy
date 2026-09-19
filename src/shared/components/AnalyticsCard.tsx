interface AnalyticsCardProps {
  label: string;
  value: string | number;
  trend?: string;
  negative?: boolean;
  accent?: 'indigo' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan';
}

export function AnalyticsCard({ label, value, trend, negative }: AnalyticsCardProps) {
  return (
    <article className="rounded-xl border border-[#EAEAEA] bg-white p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#787774]">{label}</p>
      <p className="mt-2 text-4xl font-bold tracking-tight text-[#1A1A1A]">{value}</p>
      {trend ? (
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${negative ? "text-[#787774]" : "text-[#787774]"}`}>
          <span>{negative ? "down" : "up"}</span>
          <span>{trend}</span>
        </p>
      ) : null}
    </article>
  );
}

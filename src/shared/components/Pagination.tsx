'use client'

import { useTranslation } from "@/i18n/hooks/useTranslation";

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | "...")[] = [1]

  if (current > 3) pages.push("...")

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push("...")

  pages.push(total)

  return pages
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const { t } = useTranslation()
  const pages = getPageNumbers(page, totalPages)

  return (
    <div className="mt-5 flex items-center justify-between rounded-[28px] border border-[#EAEAEA] bg-white px-5 py-3 text-sm font-bold text-[#555555] shadow-[0_18px_42px_rgba(16,26,36,0.07)]">
      <span>{t("common.page")} {page} {t("common.of")} {totalPages}</span>
      <div className="flex items-center gap-2">
        <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)} className="rounded-xl bg-[#F5F5F5] px-4 py-2 text-[#555555] transition-all duration-200 hover:bg-[#EAEAEA] disabled:opacity-50">{t("common.previous")}</button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-[#787774]">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-bold transition-colors ${
                p === page
                  ? "bg-accent text-accent-foreground"
                  : "bg-white text-[#555555] hover:bg-accent/10"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} className="rounded-xl bg-accent px-4 py-2 font-bold text-accent-foreground transition-all duration-200 hover:bg-accent-hover disabled:opacity-50">{t("common.next")}</button>
      </div>
    </div>
  );
}

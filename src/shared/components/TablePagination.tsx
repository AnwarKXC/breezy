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

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  pageSizeOptions?: readonly number[]
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const { t } = useTranslation()
  const pages = getPageNumbers(currentPage, totalPages)

  return (
    <div className="flex flex-col gap-3 border-t border-[#EAEAEA] px-4 py-3 text-sm font-medium text-[#787774] xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span>
          {t("common.showing")
            .replace("{from}", String((currentPage - 1) * pageSize + 1))
            .replace("{to}", String(Math.min(currentPage * pageSize, totalItems)))
            .replace("{total}", String(totalItems))}
        </span>
        {pageSizeOptions?.length && onPageSizeChange ? (
          <label className="flex items-center gap-2">
            <span>{t("common.rowsPerPage")}</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="form-control min-h-9 py-1"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-3 text-sm font-medium text-[#333333] hover:bg-[#F9F9F8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("common.previous")}
        </button>
        {pages.map((page, i) =>
          page === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-sm text-[#787774]">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-sm font-bold transition-colors ${
                page === currentPage
                  ? "bg-[#1A1A1A] text-white"
                  : "border border-[#EAEAEA] bg-white text-[#333333] hover:bg-[#F9F9F8]"
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-9 rounded-lg bg-[#1A1A1A] px-3 text-sm font-medium text-white hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("common.next")}
        </button>
      </div>
    </div>
  )
}

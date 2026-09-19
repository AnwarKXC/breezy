'use client'

interface CursorTableFooterProps {
  canNext: boolean
  canPrevious: boolean
  nextLabel: string
  onNext: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onPrevious: () => void
  page: number
  pageLabel: string
  pageSize: number
  pageSizeOptions: readonly number[]
  previousLabel: string
  rowsPerPageLabel?: string
  totalPages: number
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let page = start; page <= end; page += 1) pages.push(page)

  if (current < total - 2) pages.push('...')
  pages.push(total)

  return pages
}

export function CursorTableFooter({
  canNext,
  canPrevious,
  nextLabel,
  onNext,
  onPageChange,
  onPageSizeChange,
  onPrevious,
  page,
  pageLabel,
  pageSize,
  pageSizeOptions,
  previousLabel,
  rowsPerPageLabel = 'Rows per page',
  totalPages,
}: CursorTableFooterProps) {
  const pages = getPageNumbers(page, totalPages)

  return (
    <nav className="flex flex-col gap-3 border-t border-[#EAEAEA] pt-4 text-sm font-medium text-[#787774] xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span>
          {pageLabel} <span className="text-[#787774]">/ {totalPages}</span>
        </span>
        <label className="flex items-center gap-2 text-[#787774]">
          <span>{rowsPerPageLabel}</span>
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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canPrevious}
          onClick={onPrevious}
          className="h-9 rounded-lg border border-[#EAEAEA] bg-white px-3 text-[#555555] transition-all duration-200 hover:bg-[#F9F9F8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {previousLabel}
        </button>
        {pages.map((item, index) => {
          if (item === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-1 text-[#787774]">
                ...
              </span>
            )
          }

          const canOpenPage = item <= totalPages

          return (
            <button
              key={item}
              type="button"
              disabled={!canOpenPage}
              onClick={() => onPageChange(item)}
              className={`grid h-9 min-w-9 place-items-center rounded-lg px-3 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                item === page
                  ? 'bg-[#1A1A1A] text-white'
                  : 'border border-[#EAEAEA] bg-white text-[#555555] hover:bg-[#F9F9F8]'
              }`}
            >
              {item}
            </button>
          )
        })}
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="h-9 rounded-lg bg-[#1A1A1A] px-3 font-medium text-white transition-all duration-200 hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {nextLabel}
        </button>
      </div>
    </nav>
  )
}

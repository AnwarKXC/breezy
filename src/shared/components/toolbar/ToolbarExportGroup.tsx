'use client'

interface ToolbarExportGroupProps {
  onExportCsv: () => void
  onExportPdf: () => void
  csvLabel: string
  pdfLabel: string
  csvExporting?: boolean
  pdfExporting?: boolean
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function ToolbarExportGroup({ onExportCsv, onExportPdf, csvLabel, pdfLabel, csvExporting, pdfExporting }: ToolbarExportGroupProps) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-[#EAEAEA] bg-white text-sm font-medium text-[#333333]">
      <button
        type="button"
        onClick={onExportCsv}
        disabled={csvExporting}
        className="inline-flex items-center gap-1.5 px-3 py-2 transition-all duration-200 hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {csvExporting ? <Spinner /> : null}
        {csvLabel}
      </button>
      <button
        type="button"
        onClick={onExportPdf}
        disabled={pdfExporting}
        className="inline-flex items-center gap-1.5 border-s border-[#EAEAEA] px-3 py-2 transition-all duration-200 hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pdfExporting ? <Spinner /> : null}
        {pdfLabel}
      </button>
    </div>
  )
}

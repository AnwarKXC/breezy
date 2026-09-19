'use client'

import type { BookingWarning } from '../types'

interface Props {
  warnings: BookingWarning[]
}

const severityStyles = {
  error: 'border-red-200 bg-[#FDEBEC] text-red-800',
  warning: 'border-amber-200 bg-[#FBF3DB] text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

const severityIcons = {
  error: '\u25CF',
  warning: '\u25C6',
  info: '\u25CB',
}

export function InvoiceWizardWarnings({ warnings }: Props) {
  if (warnings.length === 0) return null

  return (
    <div className="space-y-2">
      {warnings.map((warning, idx) => (
        <div
          key={`${warning.type}-${idx}`}
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${severityStyles[warning.severity]}`}
        >
          <span className="mt-0.5 shrink-0 font-bold" aria-hidden="true">
            {severityIcons[warning.severity]}
          </span>
          <div className="min-w-0 flex-1">
            <p>{warning.message}</p>
            {warning.actions && warning.actions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {warning.actions.map((action, ai) => (
                  <button
                    key={`${action.action}-${ai}`}
                    type="button"
                    className="rounded-md border border-current px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-black/5"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

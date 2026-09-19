'use client'

import { useMemo } from 'react'

import { FloatingInput } from '@/shared/components/FloatingField'
import { ToolbarSearch, ToolbarFilterSelect, ToolbarExportGroup } from '@/shared/components/toolbar'
import { LOG_ACTIONS, LOG_MODULES } from '@/types/logs'
import type { LogAction, LogModule, LogsFilters } from '../types'

interface LogsToolbarProps {
  filters: LogsFilters
  labels: {
    actionFilter: string
    allActions: string
    allModules: string
    exportCsv: string
    exportPdf: string
    fromDate: string
    moduleFilter: string
    toDate: string
    userFilter: string
  }
  onChange: (filters: LogsFilters) => void
  onExportCsv: () => void
  onExportPdf: () => void
}

const actionValues = Object.values(LOG_ACTIONS)
const moduleValues = Object.values(LOG_MODULES)

export function LogsToolbar({ filters, labels, onChange, onExportCsv, onExportPdf }: LogsToolbarProps) {
  const moduleOptions = useMemo(
    () => [
      { label: labels.allModules, value: '' },
      ...moduleValues.map((m) => ({ label: m, value: m })),
    ],
    [labels.allModules],
  )

  const actionOptions = useMemo(
    () => [
      { label: labels.allActions, value: '' },
      ...actionValues.map((a) => ({ label: a, value: a })),
    ],
    [labels.allActions],
  )

  return (
    <div className="grid gap-3 border-y border-[#EAEAEA] py-4 xl:grid-cols-[1fr_auto] xl:items-center">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <ToolbarSearch
          value={filters.userId ?? ''}
          onChange={(value) => onChange({ ...filters, userId: value.trim() || undefined })}
          placeholder={labels.userFilter}
        />
        <FloatingInput
          aria-label={labels.fromDate}
          type="date" max={filters.toDate || undefined}
          value={filters.fromDate ?? ''}
          onChange={(event) => onChange({ ...filters, fromDate: event.target.value || undefined })}
          label={labels.fromDate}
          wrapperClassName="is-filled"
        />
        <FloatingInput
          aria-label={labels.toDate}
          type="date" min={filters.fromDate || undefined}
          value={filters.toDate ?? ''}
          onChange={(event) => onChange({ ...filters, toDate: event.target.value || undefined })}
          label={labels.toDate}
          wrapperClassName="is-filled"
        />
        <ToolbarFilterSelect<string>
          ariaLabel={labels.moduleFilter}
          options={moduleOptions}
          value={filters.module ?? ''}
          onChange={(value) => onChange({ ...filters, module: (value || undefined) as LogModule | undefined })}
        />
        <ToolbarFilterSelect<string>
          ariaLabel={labels.actionFilter}
          options={actionOptions}
          value={filters.action ?? ''}
          onChange={(value) => onChange({ ...filters, action: (value || undefined) as LogAction | undefined })}
        />
      </div>
      <ToolbarExportGroup
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
        csvLabel={labels.exportCsv}
        pdfLabel={labels.exportPdf}
      />
    </div>
  )
}

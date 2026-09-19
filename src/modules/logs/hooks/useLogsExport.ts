'use client'

import { useCallback, useState } from 'react'
import type { Locale } from '@/i18n/config'
import type { LogEntry } from '../types'
import { buildLogsCsv } from '../services/logsCsvExport'
import { exportLogsPdf } from '../services/logsPdfExport'

type ExportLabels = Record<'action' | 'createdAt' | 'description' | 'entity' | 'module' | 'title' | 'user', string>

const fileName = (ext: string) => `logs-${new Date().toISOString().slice(0, 10)}.${ext}`

export function useLogsExport(logs: LogEntry[], labels: ExportLabels, locale: Locale) {
  const [error, setError] = useState<string | null>(null)

  const exportCsv = useCallback(() => {
    try {
      setError(null)
      if (!logs.length) return
      const csv = buildLogsCsv(logs, labels)
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName('csv')
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Export failed')
    }
  }, [labels, logs])

  const exportPdf = useCallback(() => {
    setError(null)
    if (!logs.length) return
    void exportLogsPdf(logs, labels, locale, fileName('pdf')).catch(() => {
      setError('Export failed')
    })
  }, [labels, locale, logs])

  return { error, exportCsv, exportPdf }
}

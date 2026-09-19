'use client'

import { useCallback, useState } from 'react'
import type { Locale } from '@/i18n/config'
import type { User } from '../types'
import { buildUsersCsv } from '../utils/userCsvExport'
import { exportUsersPdf } from '../utils/userPdfExport'

interface ExportLabels {
  createdAt: string
  email: string
  name: string
  phone: string
  role: string
  title: string
}

const fileStamp = () => new Date().toISOString().slice(0, 10)

export function useUsersExport(
  users: User[],
  labels: ExportLabels,
  locale: Locale,
) {
  const [error, setError] = useState<string | null>(null)

  const exportCsv = useCallback(() => {
    setError(null)
    const csv = buildUsersCsv(users, labels)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `users-${fileStamp()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [labels, users])

  const exportPdf = useCallback(() => {
    setError(null)
    void exportUsersPdf(users, labels, locale, `users-${fileStamp()}.pdf`).catch(() => {
      setError('auth/request_failed')
    })
  }, [labels, locale, users])

  return { error, exportCsv, exportPdf }
}

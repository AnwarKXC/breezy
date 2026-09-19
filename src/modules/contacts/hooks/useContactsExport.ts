'use client'

import { useCallback, useState } from 'react'
import type { Locale } from '@/i18n/config'
import type { Contact } from '../types'
import { buildContactsCsv } from '../utils/contactCsvExport'
import { exportContactsPdf } from '../utils/contactPdfExport'

export interface ContactsExportLabels {
  name: string
  type: string
  phone: string
  email: string
  country: string
  city: string
  responsiblePerson: string
  idPassport: string
  createdAt: string
  title: string
}

const fileStamp = () => new Date().toISOString().slice(0, 10)

export function useContactsExport(
  contacts: Contact[],
  labels: ContactsExportLabels,
  locale: Locale,
) {
  const [error, setError] = useState<string | null>(null)

  const exportCsv = useCallback(() => {
    setError(null)
    const csv = buildContactsCsv(contacts, labels)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `contacts-${fileStamp()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [contacts, labels])

  const exportPdf = useCallback(() => {
    setError(null)
    void exportContactsPdf(contacts, labels, locale, `contacts-${fileStamp()}.pdf`).catch(() => {
      setError('auth/request_failed')
    })
  }, [contacts, labels, locale])

  return { error, exportCsv, exportPdf }
}

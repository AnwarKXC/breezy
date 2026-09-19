import type { Locale } from '@/i18n/config'
import { buildAndDownloadPdf, formatPdfDateTime } from '@/shared/utils/pdfMake'
import type { User } from '../types'
import { getUserCreatedAt } from './userUi'

type ExportLabels = Record<'createdAt' | 'email' | 'name' | 'phone' | 'role' | 'title', string>

export async function exportUsersPdf(
  users: User[],
  labels: ExportLabels,
  locale: Locale,
  fileName: string,
): Promise<void> {
  const rows = users.map((user) => [
    user.name,
    user.email,
    user.role,
    user.phone,
    formatPdfDateTime(getUserCreatedAt(user), locale),
  ])

  await buildAndDownloadPdf({
    title: labels.title,
    headers: [labels.name, labels.email, labels.role, labels.phone, labels.createdAt],
    rows,
    locale,
    fileName,
  })
}

import type { Locale } from '@/i18n/config'
import { buildAndDownloadPdf } from '@/shared/utils/pdfMake'
import { formatDateTime } from '@/shared/utils/date'
import type { LogEntry } from '../types'
import { getActionLabel, getLogDescription, getModuleLabel } from '../utils/logDisplay'

type ExportLabels = Record<'action' | 'createdAt' | 'description' | 'entity' | 'module' | 'title' | 'user', string>

export async function exportLogsPdf(
  logs: LogEntry[],
  labels: ExportLabels,
  locale: Locale,
  fileName: string,
  t: (key: string) => string,
): Promise<void> {
  if (!logs.length) return

  const rows = logs.map((log) => [
    log.actor.displayName ?? log.actor.name ?? log.actor.id,
    getActionLabel(log.action, t),
    getModuleLabel(log.module, t),
    log.target?.id ?? log.target?.type ?? '',
    getLogDescription(log, t),
    formatDateTime(new Date(log.createdAt.seconds * 1000 + log.createdAt.nanoseconds / 1e6).toISOString(), locale),
  ])

  await buildAndDownloadPdf({
    title: labels.title,
    headers: [labels.user, labels.action, labels.module, labels.entity, labels.description, labels.createdAt],
    rows,
    locale,
    fileName,
  })
}

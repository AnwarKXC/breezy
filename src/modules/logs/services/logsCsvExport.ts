import type { LogEntry } from '../types'
import {
  formatLogDate,
  getActionLabel,
  getActorLabel,
  getLogDescription,
  getModuleLabel,
  getTargetLabel,
} from '../utils/logDisplay'

interface ExportLabels {
  action: string
  createdAt: string
  description: string
  entity: string
  module: string
  title: string
  user: string
}

function escapeCsvCell(value: string | undefined | null) {
  const safe = value ?? ''
  return `"${safe.replaceAll('"', '""')}"`
}

export function buildLogsCsv(
  logs: LogEntry[],
  labels: ExportLabels,
) {
  const header = [labels.user, labels.action, labels.module, labels.entity, labels.description, labels.createdAt]
  const rows = logs.map((log) => [
    getActorLabel(log),
    getActionLabel(log.action),
    getModuleLabel(log.module),
    getTargetLabel(log),
    getLogDescription(log),
    formatLogDate(log.createdAt),
  ])

  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\n')
}

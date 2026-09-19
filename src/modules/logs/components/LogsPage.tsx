'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useLogs } from '../hooks/useLogs'
import { useLogsExport } from '../hooks/useLogsExport'
import { LogsAnalytics } from './LogsAnalytics'
import { LogsLoadingState, LogsStateCard } from './LogsStates'
import { LogsPagination } from './LogsPagination'
import { LogsTable } from './LogsTable'
import { LogsToolbar } from './LogsToolbar'

function errorDescription(error: string | null, t: (key: string) => string) {
  if (error === 'logs/permission_denied') return t('logs.permissionDenied')
  if (error === 'logs/invalid_session') return t('logs.invalidSession')
  return t('logs.genericError')
}

export function LogsPage() {
  const { locale, t } = useTranslation()
  const logs = useLogs()
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([])
  const labels = {
    action: t('logs.action'),
    actionFilter: t('logs.actionFilter'),
    allActions: t('logs.allActions'),
    allModules: t('logs.allModules'),
    createdAt: t('logs.createdAt'),
    description: t('logs.description'),
    entity: t('logs.entity'),
    exportCsv: t('logs.exportCsv'),
    exportPdf: t('logs.exportPdf'),
    exportTitle: t('logs.exportTitle'),
    fromDate: t('logs.fromDate'),
    module: t('logs.module'),
    moduleFilter: t('logs.moduleFilter'),
    mostActiveUser: t('logs.analytics.mostActiveUser'),
    mostUsedModule: t('logs.analytics.mostUsedModule'),
    title: t('logs.title'),
    totalToday: t('logs.analytics.totalToday'),
    toDate: t('logs.toDate'),
    user: t('logs.user'),
    userFilter: t('logs.userFilter'),
  }

  const selectedLogs = useMemo(
    () => logs.logs.filter((log) => selectedLogIds.includes(log.id)),
    [logs.logs, selectedLogIds]
  )
  const exportLogs = selectedLogs.length ? selectedLogs : logs.logs
  const { exportCsv, exportPdf } = useLogsExport(exportLogs, labels, locale)

  return (
    <main className="flex min-w-0 w-full flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">{t('logs.title')}</h1>
          <p className="mt-1 text-sm font-medium text-[#787774]">{t('logs.subtitle')}</p>
        </header>
        <LogsAnalytics analytics={logs.analytics} loading={logs.loading} labels={labels} />
        <LogsToolbar filters={logs.filters} labels={labels} onChange={logs.updateFilters} onExportCsv={exportCsv} onExportPdf={exportPdf} />
        {logs.loading ? <LogsLoadingState /> : null}
        {!logs.loading && logs.error ? (
          <LogsStateCard title={t('logs.errorTitle')} description={errorDescription(logs.error, t)} />
        ) : null}
        {!logs.loading && !logs.error && !logs.logs.length ? (
          <LogsStateCard title={t('logs.emptyTitle')} description={t('logs.emptyDescription')} />
        ) : null}
        {!logs.loading && !logs.error && logs.logs.length ? (
          <>
            <LogsTable
              logs={logs.logs}
              labels={labels}
              selectedRowIds={selectedLogIds}
              onSelectedRowIdsChange={setSelectedLogIds}
            />
            <LogsPagination
              page={logs.page}
              pageSize={logs.pageSize}
              pageSizeOptions={logs.pageSizeOptions}
              totalPages={logs.totalPages}
              label={t("logs.page")}
              previousLabel={t("logs.previous")}
              nextLabel={t("logs.loadMore")}
              canPrevious={logs.canPrevious}
              canNext={logs.canNext}
              onPrevious={logs.previousPage}
              onNext={logs.nextPage}
              onPageChange={logs.goToPage}
              onPageSizeChange={logs.updatePageSize}
            />
          </>
        ) : null}
    </main>
  )
}

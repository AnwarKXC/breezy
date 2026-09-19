import { memo, useMemo } from "react";

import { Table, type TableColumn } from "@/shared/table";
import { useLocale } from "@/i18n/components/LocaleContext";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import type { LogEntry } from "../types";
import {
  formatLogDate,
  getActionLabel,
  getActorLabel,
  getLogDescription,
  getModuleLabel,
  getTargetLabel,
} from "../utils/logDisplay";

type LogRow = LogEntry & Record<string, unknown>;

function ActorCell({ log }: { log: LogEntry }) {
  const actorLabel = getActorLabel(log);
  const actorId = log.actor?.id;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F5F5F5] text-xs font-bold text-[#333333]">
        {actorLabel[0]?.toUpperCase() || "?"}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[#1A1A1A]">
          {actorLabel}
        </span>
        {actorId && actorId !== actorLabel ? (
          <span className="block break-all text-xs text-[#787774]">
            {actorId}
          </span>
        ) : null}
      </span>
    </div>
  );
}

interface LogsTableProps {
  labels: Record<string, string>;
  logs: LogEntry[];
  selectedRowIds?: string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;
}

export const LogsTable = memo(function LogsTable({
  labels,
  logs,
  selectedRowIds,
  onSelectedRowIdsChange,
}: LogsTableProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const columns = useMemo<TableColumn<LogRow>[]>(() => [
    {
      key: "actor",
      label: labels.user,
      render: (_value, log) => <ActorCell log={log} />,
    },
    {
      key: "action",
      label: labels.action,
      render: (_value, log) => (
          <span className="rounded-md border border-[#EAEAEA] bg-[#F9F9F8] px-2.5 py-1 text-xs font-medium text-[#333333]">
          {getActionLabel(log.action, t)}
        </span>
      ),
    },
    { key: "module", label: labels.module, render: (_value, log) => getModuleLabel(log.module, t) },
    {
      key: "description",
      label: labels.description,
      render: (_value, log) => getLogDescription(log, t),
    },
    {
      key: "target",
      label: labels.entity,
      render: (_value, log) => (
        <span className="text-xs font-semibold text-[#787774]">
          {getTargetLabel(log)}
        </span>
      ),
    },
    { key: "createdAt", label: labels.createdAt, render: (_value, log) => formatLogDate(log.createdAt, locale) },
  ], [labels, locale, t]);

  return (
    <Table
      columns={columns}
      data={logs as LogRow[]}
      paginate={false}
      pageSize={logs.length || 1}
      selectable
      selectedRowIds={selectedRowIds}
      onSelectedRowIdsChange={onSelectedRowIdsChange}
      getRowId={(log) => log.id}
      selectionLabel={t('logs.selectLog')}
      sortable={false}
    />
  );
});

"use client";

import { memo } from "react";
import type { TableColumn } from "../table/types";
import { TablePagination } from "./TablePagination";
import { TableMobileView } from "./TableMobileView";
import { TableDesktopView } from "./TableDesktopView";
import { useTableState } from "./useTableState";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTranslation } from "@/i18n/hooks/useTranslation";

interface TableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: TableColumn<T>[];
  sortable?: boolean;
  onRowClick?: (row: T, event?: React.MouseEvent) => void;
  loading?: boolean;
  emptyMessage?: string;
  paginate?: boolean;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  selectable?: boolean;
  selectedRowIds?: readonly string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;
  getRowId?: (row: T, index: number) => string;
  selectionLabel?: string;
}

function TableInner<T extends Record<string, unknown>>({
  data,
  columns,
  sortable = true,
  onRowClick,
  loading,
  emptyMessage,
  paginate = true,
  pageSize = 10,
  pageSizeOptions,
  selectable = false,
  selectedRowIds = [],
  onSelectedRowIdsChange,
  getRowId,
  selectionLabel,
}: TableProps<T>) {
  const { t } = useTranslation();
  const table = useTableState({
    columns,
    data,
    getRowId,
    onSelectedRowIdsChange,
    pageSize,
    paginate,
    selectable,
    selectedRowIds,
    sortable,
  });

  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (loading) {
    return (
      <div className="rounded-lg border border-[#EAEAEA] bg-white p-4">
        <div className="h-64 animate-pulse rounded-lg bg-[#F5F5F5]" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-lg border border-[#EAEAEA] bg-white py-12 text-center text-sm text-[#787774]">
        {emptyMessage ?? t("common.noData")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#EAEAEA] bg-white">
      {isDesktop ? (
        <TableDesktopView
          allPageRowsSelected={table.allPageRowsSelected}
          columns={columns}
          data={table.paginatedData}
          getRowId={table.getResolvedRowId}
          isSelectable={table.isSelectable}
          onPageSelectionChange={table.handlePageSelectionChange}
          onRowClick={onRowClick}
          onRowSelectionChange={table.handleRowSelectionChange}
          onSort={table.handleSort}
          selectedRowIdSet={table.selectedRowIdSet}
          selectionLabel={selectionLabel ?? t("common.select")}
          sortable={sortable}
          somePageRowsSelected={table.somePageRowsSelected}
          sort={table.sort}
        />
      ) : (
        <TableMobileView
          data={table.paginatedData}
          columns={columns}
          onRowClick={onRowClick}
          selectable={table.isSelectable}
          isRowSelected={(row, index) => table.selectedRowIdSet.has(table.getResolvedRowId(row, index))}
          onToggleRow={(row, index, checked) =>
            table.handleRowSelectionChange(table.getResolvedRowId(row, index), checked)
          }
          selectionLabel={selectionLabel ?? t("common.select")}
        />
      )}
      {paginate && table.sortedData.length > 0 ? (
        <TablePagination
          currentPage={table.currentPage}
          totalPages={table.totalPages}
          pageSize={table.activePageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={table.sortedData.length}
          onPageChange={table.setPage}
          onPageSizeChange={table.handlePageSizeChange}
        />
      ) : null}
    </div>
  );
}

export const Table = memo(TableInner, (prevProps, nextProps) => {
  return (
    prevProps.data === nextProps.data &&
    prevProps.columns === nextProps.columns &&
    prevProps.loading === nextProps.loading &&
    prevProps.sortable === nextProps.sortable
  )
}) as typeof TableInner;

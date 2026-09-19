import { memo, useMemo } from "react";

import { Table, TableActionsMenu, type TableColumn } from "@/shared/table";
import { useLocale } from "@/i18n/components/LocaleContext";
import type { User } from "../types";
import { formatUserDate, getInitials } from "../utils/userUi";

type UserTableRow = User & Record<string, unknown>;

interface UsersTableProps {
  users: User[];
  labels: Record<string, string>;
  onDelete?: (id: string) => void;
  onEdit?: (user: User) => void;
  onRowClick?: (user: User) => void;
  selectedRowIds?: string[];
  onSelectedRowIdsChange?: (ids: string[]) => void;
}

function UserNameCell({ user }: { user: User }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F5F5F5] text-xs font-bold text-[#333333]">
        {getInitials(user.name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[#1A1A1A]">
          {user.name}
        </span>
        <span className="block break-all text-xs text-[#787774]">
          {user.email}
        </span>
      </span>
    </div>
  );
}

export const UsersTable = memo(function UsersTable({
  users,
  labels,
  onDelete,
  onEdit,
  onRowClick,
  selectedRowIds,
  onSelectedRowIdsChange,
}: UsersTableProps) {
  const locale = useLocale();
  const hasActions = Boolean(onDelete || onEdit);
  const columns = useMemo(() => {
    const tableColumns: TableColumn<UserTableRow>[] = [
      {
        key: "name",
        label: labels.name,
        render: (_value, user) => <UserNameCell user={user} />,
      },
      {
        key: "role",
        label: labels.role,
        render: (_value, user) => (
          <span className="rounded-md border border-[#EAEAEA] bg-[#F9F9F8] px-2.5 py-1 text-xs font-medium text-[#333333]">
            {user.role}
          </span>
        ),
      },
      { key: "phone", label: labels.phone },
      {
        key: "createdAt",
        label: labels.createdAt,
        render: (_value, user) => (
          <span className="text-[#787774]">{formatUserDate(user, locale)}</span>
        ),
      },
    ];

    if (hasActions) {
      tableColumns.push({
        key: "id",
        label: labels.actions,
        render: (_value, user) => (
          <TableActionsMenu
            actions={[
              ...(onEdit
                ? [{ label: labels.edit, onSelect: () => onEdit(user) }]
                : []),
              ...(onDelete
                ? [
                    {
                      destructive: true,
                      label: labels.delete,
                      onSelect: () => onDelete(user.id),
                    },
                  ]
                : []),
            ]}
            ariaLabel={labels.actions}
          />
        ),
      });
    }

    return tableColumns;
  }, [hasActions, labels, onDelete, onEdit, locale]);

  return (
    <Table
      columns={columns}
      data={users as UserTableRow[]}
      paginate={false}
      pageSize={users.length || 1}
      selectable
      selectedRowIds={selectedRowIds}
      onSelectedRowIdsChange={onSelectedRowIdsChange}
      getRowId={(user) => user.id}
      selectionLabel={labels.select ?? "Select user"}
      sortable={false}
      onRowClick={onRowClick ? (row) => onRowClick(row as User) : undefined}
    />
  );
});

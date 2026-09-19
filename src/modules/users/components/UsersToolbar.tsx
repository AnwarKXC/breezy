import { useMemo } from 'react'

import { ToolbarSearch, ToolbarFilterSelect, ToolbarViewToggle, ToolbarExportGroup } from '@/shared/components/toolbar'
import type { UserRole } from '../types'
import { USER_ROLES } from '../utils/userUi'

type ViewMode = 'row' | 'grid'
type RoleFilter = UserRole | 'all'

interface UsersToolbarProps {
  query: string
  role: RoleFilter
  view: ViewMode
  labels: Record<string, string>
  roleLabels: Record<RoleFilter, string>
  onQueryChange: (value: string) => void
  onRoleChange: (value: RoleFilter) => void
  onViewChange: (value: ViewMode) => void
  onExportCsv: () => void
  onExportPdf: () => void
}

export function UsersToolbar(props: UsersToolbarProps) {
  const roleOptions = useMemo(
    () =>
      [
        { label: props.roleLabels.all, value: 'all' },
        ...USER_ROLES.map((role) => ({ label: props.roleLabels[role], value: role })),
      ] satisfies { label: string; value: RoleFilter }[],
    [props.roleLabels],
  )

  return (
    <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <ToolbarSearch
          value={props.query}
          onChange={props.onQueryChange}
          placeholder={props.labels.searchPlaceholder}
        />
        <ToolbarFilterSelect<RoleFilter>
          ariaLabel={props.labels.roleFilter}
          options={roleOptions}
          value={props.role}
          onChange={props.onRoleChange}
        />
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <ToolbarViewToggle
          view={props.view}
          onChange={props.onViewChange}
          rowLabel={props.labels.rowView}
          gridLabel={props.labels.gridView}
        />
        <ToolbarExportGroup
          onExportCsv={props.onExportCsv}
          onExportPdf={props.onExportPdf}
          csvLabel={props.labels.exportCsv}
          pdfLabel={props.labels.exportPdf}
        />
      </div>
    </div>
  )
}

import { memo, useMemo } from 'react'

import { ToolbarSearch, ToolbarFilterSelect, ToolbarViewToggle, ToolbarExportGroup } from '@/shared/components/toolbar'
import type { ContactType } from '../types'
import { CONTACT_TYPES } from '../constants'

type ViewMode = 'row' | 'grid'
type TypeFilter = ContactType | 'all'

interface ContactsToolbarProps {
  query: string
  type: TypeFilter
  view: ViewMode
  labels: Record<string, string>
  typeLabels: Record<TypeFilter, string>
  onQueryChange: (value: string) => void
  onTypeChange: (value: TypeFilter) => void
  onViewChange: (value: ViewMode) => void
  onExportCsv: () => void
  onExportPdf: () => void
}

export const ContactsToolbar = memo(function ContactsToolbar(props: ContactsToolbarProps) {
  const typeOptions = useMemo(
    () =>
      [
        { label: props.typeLabels.all, value: 'all' },
        ...CONTACT_TYPES.map((t) => ({ label: props.typeLabels[t], value: t })),
      ] satisfies { label: string; value: TypeFilter }[],
    [props.typeLabels],
  )

  return (
    <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <ToolbarSearch
          value={props.query}
          onChange={props.onQueryChange}
          placeholder={props.labels.searchPlaceholder}
        />
        <ToolbarFilterSelect<TypeFilter>
          ariaLabel={props.labels.typeFilter}
          options={typeOptions}
          value={props.type}
          onChange={props.onTypeChange}
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
})

'use client'

import { useMemo } from 'react'
import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import { GridView } from '@/shared'
import { ToolbarSearch, ToolbarViewToggle } from '@/shared/components/toolbar'
import type { RoomType } from '@/modules/room-types/types'

type RoomTypeRow = RoomType & Record<string, unknown>; interface RoomTypesSectionProps {
 roomTypes: {
 items: RoomType[]
 remove: (id: string) => Promise<void> }
 filteredTypes: RoomType[]
 typesViewMode: 'row' | 'grid'
 onTypesViewModeChange: (mode: 'row' | 'grid') => void
 typesQuery: string
 onTypesQueryChange: (query: string) => void
 onOpenCreateType: () => void
 onStartEditType: (rt: RoomType) => void
 onOpenDeleteDialog: (action: () => void) => void
 getTypeColor: (name: string) => string
 formatCurrency: (amount: number) => string
 t: (key: string) => string
}

export function RoomTypesSection({
 roomTypes,
 filteredTypes,
 typesViewMode,
 onTypesViewModeChange,
 typesQuery,
 onTypesQueryChange,
 onOpenCreateType,
 onStartEditType,
 onOpenDeleteDialog,
 getTypeColor,
 formatCurrency,
 t,
}: RoomTypesSectionProps) {
 const typeColumns = useMemo(() => {
 const cols: TableColumn<RoomTypeRow>[] = [
 {
  key: 'name',
  label: t('common.name'),
 render: (_value, row) => (
 <div className="flex items-center gap-2"> <span className={`inline-block h-2.5 w-2.5 rounded-full ${getTypeColor(row.name)}`} /> <span>{row.name}</span> </div> ),
 },
 {
 key: 'basePrice',
 label: t('rooms.price'),
 render: (_value, row) => <span className="font-mono tabular-nums">{formatCurrency(row.basePrice)}</span>,
 },
 {
 key: 'defaultCapacity',
 label: t('rooms.capacity'),
 render: (_value, row) => <span className="text-[#787774]">{row.defaultCapacity}</span>,
 },
 {
 key: 'id',
 label: t('common.actions'),
 render: (_value, row) => (
 <TableActionsMenu
 actions={[
 { label: t('common.edit'), onSelect: () => onStartEditType(row as RoomType) },
 { destructive: true, label: t('common.delete'), onSelect: () => onOpenDeleteDialog(() => { void roomTypes.remove(row.id) }) },
 ]}
 ariaLabel={t('common.actions')}
 /> ),
 },
 ]
 return cols
 }, [t, onStartEditType, roomTypes, onOpenDeleteDialog, formatCurrency, getTypeColor])

 return (
 <div className="space-y-4"> <div className="flex items-center justify-between"> <h3 className="text-base font-semibold text-[#1A1A1A]">{t('rooms.roomTypes')}</h3> <button
 onClick={onOpenCreateType}
 className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover transition-colors"> + {t('rooms.newRoomType')}
 </button> </div> <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 sm:flex-row sm:items-center sm:justify-between"> <div className="w-full sm:max-w-xs"> <ToolbarSearch
 value={typesQuery}
 onChange={onTypesQueryChange}
  placeholder={t('rooms.searchTypes')}
  /> </div> <ToolbarViewToggle
  view={typesViewMode}
  onChange={onTypesViewModeChange}
  rowLabel={t('rooms.pricingForm.tableView')}
  gridLabel={t('rooms.pricingForm.gridView')}
 /> </div> {typesViewMode === 'row' ? (
 <Table
 columns={typeColumns}
 data={filteredTypes as RoomTypeRow[]}
 paginate={false}
 sortable={false}
 getRowId={(row) => row.id}
 /> ) : (
 <GridView<RoomType> items={filteredTypes}
 getKey={(rt) => rt.id}
 renderItem={(rt) => (
 <div className="space-y-3"> <div className="flex items-center justify-between"> <span className="text-lg font-bold text-[#1A1A1A]">{rt.name}</span> </div>   <div className="grid grid-cols-2 gap-2 text-sm"> <div> <span className="text-[#787774]">{t('rooms.price')}</span> <p className="font-mono font-semibold text-[#1A1A1A]">{formatCurrency(rt.basePrice)}</p> </div> <div> <span className="text-[#787774]">{t('rooms.capacity')}</span> <p className="font-medium text-[#1A1A1A]">{rt.defaultCapacity} {t('rooms.guests')}</p> </div> </div> </div> )}
 /> )}
 </div> )
}

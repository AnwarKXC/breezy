'use client'

import { useMemo } from 'react'
import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import { GridView } from '@/shared'
import { ToolbarSearch, ToolbarViewToggle } from '@/shared/components/toolbar'
import type { RoomTypePricing } from '@/modules/pricing/types'

type PricingRow = RoomTypePricing & Record<string, unknown>; interface RoomPricingSectionProps {
 pricing: {
 items: RoomTypePricing[]
 remove: (id: string) => Promise<void> }
 filteredPricing: RoomTypePricing[]
 pricingViewMode: 'row' | 'grid'
 onPricingViewModeChange: (mode: 'row' | 'grid') => void
 pricingQuery: string
 onPricingQueryChange: (query: string) => void
 onOpenCreatePricing: () => void
 onStartEditPricing: (p: RoomTypePricing) => void
 onOpenDeleteDialog: (action: () => void) => void
 getTypeName: (typeId: string) => string
 formatCurrency: (amount: number) => string
 t: (key: string) => string
}

export function RoomPricingSection({
 pricing,
 filteredPricing,
 pricingViewMode,
 onPricingViewModeChange,
 pricingQuery,
 onPricingQueryChange,
 onOpenCreatePricing,
 onStartEditPricing,
 onOpenDeleteDialog,
 getTypeName,
 formatCurrency,
 t,
}: RoomPricingSectionProps) {
 const pricingColumns = useMemo(() => {
 const cols: TableColumn<PricingRow>[] = [
 {
 key: 'roomTypeId',
 label: t('rooms.type'),
 render: (_value, row) => <span className="font-medium">{getTypeName(row.roomTypeId)}</span>,
 },
 {
 key: 'price',
 label: t('rooms.price'),
 render: (_value, row) => <span className="font-mono tabular-nums">{formatCurrency(row.price)}</span>,
 },
  { key: 'currency', label: t('rooms.pricingForm.currency') },
  {
  key: 'effectiveFrom',
  label: t('rooms.effective'),
 render: (_value, row) => (
  <span className="text-[#787774] text-xs"> {row.effectiveFrom ? String(row.effectiveFrom).slice(0, 10) : t('rooms.current')}
  {row.effectiveUntil ? ` — ${String(row.effectiveUntil).slice(0, 10)}` : ''}
  </span> ),
 },
 {
 key: 'id',
 label: t('common.actions'),
 render: (_value, row) => (
 <TableActionsMenu
 actions={[
 { label: t('common.edit'), onSelect: () => onStartEditPricing(row as RoomTypePricing) },
 { destructive: true, label: t('common.delete'), onSelect: () => onOpenDeleteDialog(() => { void pricing.remove(row.id) }) },
 ]}
 ariaLabel={t('common.actions')}
 /> ),
 },
 ]
 return cols
 }, [t, getTypeName, onStartEditPricing, pricing, onOpenDeleteDialog, formatCurrency])

 return (
 <div className="space-y-4"> <div className="flex items-center justify-between"> <h3 className="text-base font-semibold text-[#1A1A1A]">{t('rooms.pricing')}</h3> <button
 onClick={onOpenCreatePricing}
 className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] transition-colors"> + {t('rooms.newRate')}
 </button> </div> <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 sm:flex-row sm:items-center sm:justify-between"> <div className="w-full sm:max-w-xs"> <ToolbarSearch
 value={pricingQuery}
 onChange={onPricingQueryChange}
  placeholder={t('rooms.searchPricing')}
  /> </div> <ToolbarViewToggle
  view={pricingViewMode}
  onChange={onPricingViewModeChange}
  rowLabel={t('rooms.pricingForm.tableView')}
  gridLabel={t('rooms.pricingForm.gridView')}
  /> </div> {pricingViewMode === 'row' ? (
  <Table
  columns={pricingColumns}
  data={filteredPricing as PricingRow[]}
  paginate={false}
  sortable={false}
  getRowId={(row) => row.id}
  emptyMessage={t('rooms.pricingForm.empty')}
 /> ) : (
 <GridView<RoomTypePricing> items={filteredPricing}
 getKey={(p) => p.id}
 renderItem={(p) => (
 <div className="space-y-3"> <div className="flex items-center justify-between"> <span className="text-lg font-bold text-[#1A1A1A]">{getTypeName(p.roomTypeId)}</span> <span className="text-xs font-medium text-[#787774]">{p.currency}</span> </div> <div className="grid grid-cols-2 gap-2 text-sm"> <div> <span className="text-[#787774]">{t('rooms.price')}</span> <p className="font-mono font-semibold text-[#1A1A1A]">{formatCurrency(p.price)}</p> </div> <div> <span className="text-[#787774]">{t('rooms.effective')}</span> <p className="font-medium text-[#1A1A1A]"> {p.effectiveFrom ? String(p.effectiveFrom).slice(0, 10) : t('rooms.current')}
 {p.effectiveUntil ? ` — ${String(p.effectiveUntil).slice(0, 10)}` : ''}
 </p> </div> </div> </div> )}
 /> )}
 </div> )
}

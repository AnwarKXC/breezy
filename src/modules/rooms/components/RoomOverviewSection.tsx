'use client'

import { useMemo } from 'react'
import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import { GridView } from '@/shared'
import { ToolbarSearch, ToolbarViewToggle } from '@/shared/components/toolbar'
import type { Room } from '../types'
import type { RoomType } from '@/modules/room-types/types'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

type RoomRow = Room & Record<string, unknown>; interface RoomOverviewSectionProps {
 rooms: {
 items: Room[]
 remove: (id: string) => Promise<void> }
 roomTypes: {
 items: RoomType[]
 }
 metrics: {
 totalRooms: number
 totalTypes: number
 available: number
 avgPrice: number
 }
 filteredRooms: Room[]
 overViewMode: 'row' | 'grid'
 onOverViewModeChange: (mode: 'row' | 'grid') => void
 overQuery: string
 onOverQueryChange: (query: string) => void
 quickNumber: string
 onQuickNumberChange: (v: string) => void
 quickFloor: number
 onQuickFloorChange: (v: number) => void
 quickTypeId: string
 onQuickTypeIdChange: (v: string) => void
 quickAdding: boolean
  onQuickAdd: () => Promise<void>; editingRoomId: string | null
 onEditingRoomIdChange: (id: string | null) => void
 roomEditStatus: Room['status']
 onRoomEditStatusChange: (status: Room['status']) => void
 roomEditPrice: number
 onRoomEditPriceChange: (price: number) => void
 onStartEditRoom: (room: Room) => void
  onSaveEditRoom: () => Promise<void>; onOpenRenameModal: (room: Room) => void
 onOpenDeleteDialog: (action: () => void) => void
 onOpenBulkModal: () => void
 canDeleteRooms?: boolean
 getTypeName: (typeId: string) => string
 getTypeColorById: (typeId: string) => string
 getEffectivePrice: (roomTypeId: string, defaultPrice: number) => number
 statusBadgeClass: (status: string) => string
 formatCurrency: (amount: number) => string
 t: (key: string) => string
}

export function RoomOverviewSection({
 rooms,
 roomTypes,
 metrics,
 filteredRooms,
 overViewMode,
 onOverViewModeChange,
 overQuery,
 onOverQueryChange,
 quickNumber,
 onQuickNumberChange,
 quickFloor,
 onQuickFloorChange,
 quickTypeId,
 onQuickTypeIdChange,
 quickAdding,
 onQuickAdd,
 editingRoomId,
 onEditingRoomIdChange,
 roomEditStatus,
 onRoomEditStatusChange,
 roomEditPrice,
 onRoomEditPriceChange,
 onStartEditRoom,
 onSaveEditRoom,
 onOpenRenameModal,
 onOpenDeleteDialog,
 onOpenBulkModal,
 canDeleteRooms,
 getTypeName,
 getTypeColorById,
 getEffectivePrice,
 statusBadgeClass,
 formatCurrency,
 t,
}: RoomOverviewSectionProps) {
 const roomColumns = useMemo(() => {
 const cols: TableColumn<RoomRow>[] = [
 { key: 'number', label: t('rooms.roomNumber') },
 {
 key: 'floor',
 label: t('rooms.floor'),
 render: (_value, row) => <span className="text-[#787774]">{row.floor}</span>,
 },
 {
 key: 'roomTypeId',
 label: t('rooms.type'),
 render: (_value, row) => <span className="text-[#787774]">{getTypeName(row.roomTypeId)}</span>,
 },
 {
 key: 'status',
 label: t('rooms.status'),
 render: (_value, row) => (
 editingRoomId === row.id ? (
 <select
 value={roomEditStatus}
 onChange={e => onRoomEditStatusChange(e.target.value as Room['status'])}
 className="rounded-lg border border-[#D4D4D4] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
 autoFocus> {(['available', 'occupied', 'maintenance', 'cleaning'] as const).map(s => (
 <option key={s} value={s}>{t(`rooms.${s}`)}</option> ))}
 </select> ) : (
 <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}> {t(`rooms.${row.status}`)}
 </span> )
 ),
 },
 {
 key: 'price',
 label: t('rooms.price'),
 render: (_value, row) => {
 const effective = getEffectivePrice(row.roomTypeId, row.price)
 const hasDiscount = effective !== row.price
 return editingRoomId === row.id ? (
 <input
 type="number" inputMode="decimal" onWheel={(event) => event.currentTarget.blur()}
 min={0}
 step="0.01"
 value={roomEditPrice}
 onChange={e => onRoomEditPriceChange(Number(e.target.value))}
 className="w-24 rounded-lg border border-[#D4D4D4] px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-300"
 /> ) : (
 <span className={`font-mono tabular-nums ${hasDiscount ? 'text-[#346538]' : ''}`}> {formatCurrency(effective)}
 {hasDiscount && <span className="ml-1.5 text-[10px] text-[#787774] line-through">{formatCurrency(row.price)}</span>}
 </span> )
 },
 },
 {
 key: 'capacity',
 label: t('rooms.capacity'),
 render: (_value, row) => <span className="text-[#787774]">{row.capacity}</span>,
 },
 {
 key: 'id',
 label: t('common.actions'),
 render: (_value, row) => (
 editingRoomId === row.id ? (
 <div className="flex justify-end gap-1"> <button onClick={onSaveEditRoom} className="text-xs font-medium text-[#346538] hover:text-emerald-800 px-2 py-1 rounded hover:bg-[#EDF3EC] transition-colors">{t('common.save')}</button> <button onClick={() => onEditingRoomIdChange(null)} className="text-xs font-medium text-[#787774] hover:text-[#333333] px-2 py-1 rounded hover:bg-accent/10 transition-colors">{t('common.cancel')}</button> </div> ) : (
 <TableActionsMenu
 actions={[
 { label: t('common.edit'), onSelect: () => onStartEditRoom(row as Room) },
  { label: t('rooms.renaming'), onSelect: () => onOpenRenameModal(row as Room) },
 { destructive: true, label: t('common.delete'), onSelect: () => onOpenDeleteDialog(() => { void rooms.remove(row.id) }) },
 ]}
 ariaLabel={t('common.actions')}
 /> )
 ),
 },
 ]
 return cols
 }, [t, editingRoomId, roomEditStatus, roomEditPrice, getTypeName, getEffectivePrice, onSaveEditRoom, onStartEditRoom, rooms, onOpenDeleteDialog, onOpenRenameModal, onRoomEditStatusChange, onRoomEditPriceChange, onEditingRoomIdChange, formatCurrency, statusBadgeClass])

 return (
 <div className="space-y-5"> <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"> {[
 { label: t('rooms.totalRooms'), value: metrics.totalRooms },
 { label: t('rooms.roomTypes'), value: metrics.totalTypes },
 { label: t('rooms.availableRooms'), value: metrics.available },
 { label: t('rooms.avgPrice'), value: <MoneyAmount amount={metrics.avgPrice} /> },
 ].map(m => (
 <div key={m.label} className="bg-white rounded-xl border border-[#EAEAEA] p-3 sm:p-4 "> <div className="text-[10px] sm:text-xs font-medium text-[#787774] uppercase tracking-wide">{m.label}</div> <div className="mt-1 text-xl sm:text-2xl font-semibold text-[#1A1A1A] tabular-nums">{m.value}</div> </div> ))}
 </div> <div className="bg-[#F9F9F8] rounded-xl p-4"> <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end"> <div> <label className="block text-xs font-medium text-[#787774] mb-1">{t('rooms.roomNumber')}</label> <input
 value={quickNumber}
 onChange={e => onQuickNumberChange(e.target.value)}
 placeholder="101"
 className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
 /> </div> <div> <label className="block text-xs font-medium text-[#787774] mb-1">{t('rooms.floor')}</label> <input
 type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
 min={0}
 value={quickFloor}
 onChange={e => onQuickFloorChange(Number(e.target.value))}
 className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
 /> </div> <div className="sm:col-span-1"> <label className="block text-xs font-medium text-[#787774] mb-1">{t('rooms.type')}</label> <select
 value={quickTypeId}
 onChange={e => onQuickTypeIdChange(e.target.value)}
 className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"> <option value="">{t('rooms.selectType')}</option> {roomTypes.items.map(rt => (
 <option key={rt.id} value={rt.id}>{rt.name}</option> ))}
 </select> </div> <button
 onClick={onQuickAdd}
 disabled={!quickNumber || !quickTypeId || quickAdding}
 className="w-full sm:w-auto rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"> {quickAdding ? t('rooms.adding') : t('common.add')}
 </button> </div> </div> <div className="flex justify-end"> <button
 onClick={onOpenBulkModal}
 className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover transition-colors"> + {t('rooms.bulkAdd')}
 </button> </div> {!roomTypes.items.length && (
 <div className="bg-white rounded-xl border border-[#EAEAEA] p-12 text-center"> <div className="text-4xl mb-3">🏗️</div> <h3 className="text-lg font-medium text-[#1A1A1A]">{t('rooms.noRoomTypes')}</h3> <p className="mt-1 text-sm text-[#787774]">{t('rooms.createTypeFirst')}</p> </div> )}

 {roomTypes.items.length> 0 && !rooms.items.length && (
 <div className="bg-white rounded-xl border border-[#EAEAEA] p-12 text-center"> <div className="text-4xl mb-3">🛏️</div> <h3 className="text-lg font-medium text-[#1A1A1A]">{t('rooms.noRooms')}</h3> <p className="mt-1 text-sm text-[#787774]">{t('rooms.addRoomHint')}</p> </div> )}

 {rooms.items.length> 0 && (
 <> <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 sm:flex-row sm:items-center sm:justify-between"> <div className="w-full sm:max-w-xs"> <ToolbarSearch
 value={overQuery}
 onChange={onOverQueryChange}
  placeholder={t('rooms.searchRooms')}
  /> </div> <ToolbarViewToggle
  view={overViewMode}
  onChange={onOverViewModeChange}
  rowLabel={t('rooms.pricingForm.tableView')}
  gridLabel={t('rooms.pricingForm.gridView')}
 /> </div> {overViewMode === 'row' ? (
 <Table
 columns={roomColumns}
 data={filteredRooms as RoomRow[]}
 paginate={false}
 sortable={false}
 getRowId={(row) => row.id}
 /> ) : (
 <GridView<Room> items={filteredRooms}
 getKey={(r) => r.id}
 renderItem={(r) => (
 <div className="relative group"> <button
 onClick={() => onOpenRenameModal(r)}
 className="w-full text-left rounded-xl border border-[#EAEAEA] bg-white p-4 hover: transition cursor-pointer"> <div className="space-y-3"> <div className="flex items-center justify-between"> <span className="text-lg font-bold text-[#1A1A1A]">{t('rooms.roomLabel')} {r.number}</span> <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}> {t(`rooms.${r.status}`)}
 </span> </div> <div className="grid grid-cols-2 gap-2 text-sm"> <div>   <span className="text-[#787774]">{t('rooms.floor')}</span> <p className="font-medium text-[#1A1A1A]">{r.floor}</p> </div> <div>   <span className="text-[#787774]">{t('rooms.type')}</span> <p className="font-medium text-[#1A1A1A] flex items-center gap-1.5"> <span className={`inline-block h-2.5 w-2.5 rounded-full ${getTypeColorById(r.roomTypeId)}`} /> {getTypeName(r.roomTypeId)}
 </p> </div> <div>   <span className="text-[#787774]">{t('rooms.price')}</span> <p className="font-mono font-semibold text-[#1A1A1A]"> {formatCurrency(getEffectivePrice(r.roomTypeId, r.price))}
 </p> </div> <div>   <span className="text-[#787774]">{t('rooms.capacity')}</span> <p className="font-medium text-[#1A1A1A]">{r.capacity} {t('rooms.guests')}</p> </div> </div> </div> </button> {canDeleteRooms && (
 <button
 onClick={(e) => { e.stopPropagation(); onOpenDeleteDialog(() => { void rooms.remove(r.id) }) }}
 className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-[#FDEBEC] p-1.5 text-[#9F2F2D] hover:bg-[#FDEBEC] hover:text-[#9F2F2D]"
   title={t('rooms.deleteRoom')}> <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"> <polyline points="3 6 5 6 21 6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /> </svg> </button> )}
 </div> )}
 /> )}
 </> )}
 </div> )
}

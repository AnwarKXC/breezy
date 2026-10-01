'use client'

import { useState, useCallback, useMemo, type FormEvent } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import { Modal, FloatingInput, GridView, DeleteConfirmationDialog } from '@/shared'
import { ToolbarSearch, ToolbarViewToggle } from '@/shared/components/toolbar'
import { useAdminRooms } from '../hooks'
import { useRoomTypes } from '@/modules/room-types/hooks'
import { usePricing } from '@/modules/pricing/hooks'
import { PricingManagement } from '@/modules/pricing/components/PricingManagement'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'
import type { CreateRoomTypeInput, UpdateRoomTypeInput } from '@/modules/room-types/types'
import type { RoomType } from '@/modules/room-types/types'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { toast } from '@/shared/toast/toastEvents'
import { MoneyAmount } from '@/shared/components/MoneyTotals'

type Section = 'overview' | 'types' | 'pricing'

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const TYPE_COLORS = [
  'bg-violet-500', 'bg-[#EDF3EC]0', 'bg-[#FBF3DB]0', 'bg-rose-500',
  'bg-cyan-500', 'bg-orange-500', 'bg-teal-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-lime-500', 'bg-[#E1F3FE]0', 'bg-fuchsia-500',
]

function getTypeColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length]
}

function isValidSection(s: string | null): s is Section {
  return s === 'overview' || s === 'types' || s === 'pricing'
}

export function RoomManagement({ canDeleteRooms }: { canDeleteRooms?: boolean }) {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [section, setSection] = useState<Section>(() => {
    const s = searchParams.get('section')
    return isValidSection(s) ? s : 'overview'
  })

  const rooms = useAdminRooms()
  const roomTypes = useRoomTypes()
  const pricing = usePricing()

  const [quickNumber, setQuickNumber] = useState('')
  const [quickFloor, setQuickFloor] = useState(1)
  const [quickTypeId, setQuickTypeId] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [roomEditStatus, setRoomEditStatus] = useState<Room['status']>('available')
  const [roomEditPrice, setRoomEditPrice] = useState(0)

  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [typeForm, setTypeForm] = useState({ name: '', slug: '', base_price: 0, default_capacity: 2 })

  const [overViewMode, setOverViewMode] = useState<'row' | 'grid'>('row')
  const [typesViewMode, setTypesViewMode] = useState<'row' | 'grid'>('row')
  const [overQuery, setOverQuery] = useState('')
  const [typesQuery, setTypesQuery] = useState('')
  const [deleteAction, setDeleteAction] = useState<null | (() => void)>(null)

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkTotal, setBulkTotal] = useState(1)
  const [bulkDistribution, setBulkDistribution] = useState<Record<string, number>>({})
  const [bulkCreating, setBulkCreating] = useState(false)

  const [renameRoom, setRenameRoom] = useState<Room | null>(null)
  const [renameNumber, setRenameNumber] = useState('')
  const [savingRename, setSavingRename] = useState(false)
  const [savingRoomType, setSavingRoomType] = useState(false)
  const [savingEditRoom, setSavingEditRoom] = useState(false)

  const openDeleteDialog = useCallback((action: () => void) => {
    setDeleteAction(() => action)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    setDeleteAction(null)
  }, [])

  const confirmDelete = useCallback(() => {
    deleteAction?.()
    closeDeleteDialog()
  }, [closeDeleteDialog, deleteAction])

  const openBulkModal = useCallback(() => {
    if (!roomTypes.items.length) return
    const dist: Record<string, number> = {}
    roomTypes.items.forEach((rt, i) => { dist[rt.id] = i === 0 ? 1 : 0 })
    setBulkDistribution(dist)
    setBulkTotal(1)
    setShowBulkModal(true)
  }, [roomTypes.items])

  const closeBulkModal = useCallback(() => {
    setShowBulkModal(false)
    setBulkCreating(false)
  }, [])

  const handleBulkTotalChange = useCallback((total: number) => {
    if (isNaN(total) || total < 1) return
    setBulkTotal(total)
    const types = roomTypes.items
    if (!types.length) return
    const perType = Math.floor(total / types.length)
    const remainder = total - perType * types.length
    const dist: Record<string, number> = {}
    types.forEach((rt, i) => {
      dist[rt.id] = i === 0 ? perType + remainder : perType
    })
    setBulkDistribution(dist)
  }, [roomTypes.items])

  const handleBulkDistChange = useCallback((typeId: string, count: number) => {
    setBulkDistribution(prev => ({ ...prev, [typeId]: Math.max(0, count) }))
  }, [])

  const bulkDistSum = useMemo(() =>
    Object.values(bulkDistribution).reduce((s, c) => s + c, 0),
  [bulkDistribution])

  const handleBulkCreate = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (bulkCreating || bulkDistSum !== bulkTotal) return
    setBulkCreating(true)
    try {
      const tmpNums = rooms.items.map(r => r.number).filter(n => n.startsWith('TEMP')).map(n => Number(n.slice(4))).filter(n => !isNaN(n))
      let idx = tmpNums.length ? Math.max(...tmpNums) : 0
      const payloads: Record<string, unknown>[] = []
      for (const rt of roomTypes.items) {
        const count = bulkDistribution[rt.id] ?? 0
        for (let i = 0; i < count; i++) {
          idx++
          payloads.push({
            number: `TEMP${String(idx).padStart(3, '0')}`,
            floor: 1,
            room_type_id: rt.id,
            status: 'available',
            price: 0,
            capacity: rt.defaultCapacity,
            amenities: [],
          })
        }
      }
      await Promise.all(payloads.map(p => fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })))
      await rooms.reload()
      toast.success(`${payloads.length} rooms created successfully`)
      closeBulkModal()
    } finally {
      setBulkCreating(false)
    }
  }, [bulkCreating, bulkDistSum, bulkTotal, bulkDistribution, rooms, roomTypes.items, closeBulkModal])

  const openRenameModal = useCallback((room: Room) => {
    setRenameRoom(room)
    setRenameNumber(room.number)
  }, [])

  const closeRenameModal = useCallback(() => {
    setRenameRoom(null)
    setRenameNumber('')
  }, [])

  const saveRename = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!renameRoom || !renameNumber.trim() || savingRename) return
    setSavingRename(true)
    try {
      await rooms.update(renameRoom.id, { number: renameNumber } as UpdateRoomInput)
      closeRenameModal()
    } finally {
      setSavingRename(false)
    }
  }, [renameRoom, renameNumber, rooms, closeRenameModal, savingRename])

  // ponytail: active.price can be 0 when only occupancy-based pricing is set; fall back to room's default
  const getEffectivePrice = useCallback((roomTypeId: string, defaultPrice: number) => {
    const now = new Date().toISOString()
    const active = pricing.items.find(p =>
      p.roomTypeId === roomTypeId &&
      (!p.effectiveFrom || p.effectiveFrom <= now) &&
      (!p.effectiveUntil || p.effectiveUntil >= now)
    )
    return (active && active.price > 0) ? active.price : defaultPrice
  }, [pricing.items])

  const getTypeName = useCallback((typeId: string) =>
    roomTypes.items.find(rt => rt.id === typeId)?.name ?? typeId,
  [roomTypes.items])

  const getTypeColorById = useCallback((typeId: string) => {
    const name = roomTypes.items.find(rt => rt.id === typeId)?.name
    return name ? getTypeColor(name) : 'bg-[#D4D4D4]'
  }, [roomTypes.items])

  const metrics = useMemo(() => ({
    totalRooms: rooms.items.length,
    totalTypes: roomTypes.items.length,
    available: rooms.items.filter(r => r.status === 'available').length,
    avgPrice: rooms.items.length
      ? rooms.items.reduce((s, r) => s + getEffectivePrice(r.roomTypeId, r.price || 0), 0) / rooms.items.length
      : 0,
  }), [rooms.items, roomTypes.items, getEffectivePrice])

  const filteredRooms = useMemo(() => {
    if (!overQuery) return rooms.items
    const q = overQuery.toLowerCase()
    return rooms.items.filter(r =>
      r.number.toLowerCase().includes(q) ||
      String(r.floor).includes(q) ||
      getTypeName(r.roomTypeId).toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    )
  }, [rooms.items, overQuery, getTypeName])

  const filteredTypes = useMemo(() => {
    if (!typesQuery) return roomTypes.items
    const q = typesQuery.toLowerCase()
    return roomTypes.items.filter(rt =>
      rt.name.toLowerCase().includes(q) ||
      rt.slug.toLowerCase().includes(q)
    )
  }, [roomTypes.items, typesQuery])

  const handleQuickAdd = useCallback(async () => {
    if (!quickNumber || !quickTypeId || quickAdding) return
    setQuickAdding(true)
    try {
      const selectedType = roomTypes.items.find(rt => rt.id === quickTypeId)
      await rooms.create({
        number: quickNumber,
        floor: quickFloor,
        room_type_id: quickTypeId,
        status: 'available',
        price: 0,
        capacity: selectedType?.defaultCapacity ?? 2,
        amenities: [],
      } as unknown as CreateRoomInput)
      setQuickNumber('')
      setQuickFloor(1)
    } finally {
      setQuickAdding(false)
    }
  }, [quickNumber, quickFloor, quickTypeId, quickAdding, rooms, roomTypes.items])

  const startEditRoom = useCallback((room: Room) => {
    setEditingRoomId(room.id)
    setRoomEditStatus(room.status)
    setRoomEditPrice(room.price)
  }, [])

  const saveEditRoom = useCallback(async () => {
    if (!editingRoomId || savingEditRoom) return
    setSavingEditRoom(true)
    try {
      await rooms.update(editingRoomId, { status: roomEditStatus, price: roomEditPrice } as UpdateRoomInput)
      setEditingRoomId(null)
    } finally {
      setSavingEditRoom(false)
    }
  }, [editingRoomId, roomEditStatus, roomEditPrice, rooms, savingEditRoom])

  const openCreateType = useCallback(() => {
    setEditingTypeId(null)
    setTypeForm({ name: '', slug: '', base_price: 0, default_capacity: 2 })
    setShowTypeModal(true)
  }, [])

  const startEditType = useCallback((rt: RoomType) => {
    setEditingTypeId(rt.id)
    setTypeForm({ name: rt.name, slug: rt.slug, base_price: rt.basePrice, default_capacity: rt.defaultCapacity })
    setShowTypeModal(true)
  }, [])

  const closeTypeModal = useCallback(() => {
    setShowTypeModal(false)
    setEditingTypeId(null)
    setTypeForm({ name: '', slug: '', base_price: 0, default_capacity: 2 })
  }, [])

  const handleTypeNameChange = useCallback((name: string) => {
    setTypeForm(f => editingTypeId ? { ...f, name } : { ...f, name, slug: toSlug(name) })
  }, [editingTypeId])

  const saveRoomType = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (!typeForm.name || savingRoomType) return
    setSavingRoomType(true)
    try {
      const payload = { ...typeForm, base_price: 0 }
      if (editingTypeId) {
        await roomTypes.update(editingTypeId, payload as UpdateRoomTypeInput)
      } else {
        await roomTypes.create(payload as unknown as CreateRoomTypeInput)
      }
      closeTypeModal()
    } finally {
      setSavingRoomType(false)
    }
  }, [typeForm, editingTypeId, roomTypes, closeTypeModal, savingRoomType])



  const statusBadgeClass = (status: string) => {
    switch (status) {
      case 'available': return 'bg-[#EDF3EC] text-[#346538] border border-emerald-200'
      case 'occupied': return 'bg-blue-50 text-blue-700 border border-blue-200'
      case 'maintenance': return 'bg-[#FBF3DB] text-[#956400] border border-amber-200'
      case 'cleaning': return 'bg-[#F9F9F8] text-[#555555] border border-[#EAEAEA]'
      default: return 'bg-[#F9F9F8] text-[#555555] border border-[#EAEAEA]'
    }
  }

  type RoomRow = Room & Record<string, unknown>
  type RoomTypeRow = RoomType & Record<string, unknown>

  const roomColumns = useMemo(() => {
    const cols: TableColumn<RoomRow>[] = [
      {
        key: 'number',
        label: t('rooms.roomNumber'),
        render: (v, row) => (
          <button
            type="button"
            onClick={() => router.push(`/${pathname.split('/')[1] ?? 'en'}/rooms/${row.id}`)}
            className="cursor-pointer text-sm font-medium text-[#346538] underline-offset-2 hover:underline"
          >
            {String(v)}
          </button>
        ),
      },
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
              onChange={e => setRoomEditStatus(e.target.value as Room['status'])}
              className="rounded-lg border border-[#D4D4D4] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
              autoFocus
            >
              {(['available', 'occupied', 'maintenance', 'cleaning'] as const).map(s => (
                <option key={s} value={s}>{t(`rooms.${s}`)}</option>
              ))}
            </select>
          ) : (
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}>
              {t(`rooms.${row.status}`)}
            </span>
          )
        ),
      },
      {
        key: 'id',
        label: t('common.actions'),
        render: (_value, row) => (
          editingRoomId === row.id ? (
            <div className="flex justify-end gap-1">
              <button onClick={saveEditRoom} disabled={savingEditRoom} className="text-xs font-medium text-[#346538] hover:text-emerald-800 px-2 py-1 rounded hover:bg-[#EDF3EC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{savingEditRoom ? t('rooms.saving') : t('common.save')}</button>
              <button onClick={() => setEditingRoomId(null)} disabled={savingEditRoom} className="text-xs font-medium text-[#787774] hover:text-[#333333] px-2 py-1 rounded hover:bg-[#F5F5F5] transition-colors disabled:opacity-50">{t('common.cancel')}</button>
            </div>
          ) : (
            <TableActionsMenu
              actions={[
                { label: t('common.edit'), onSelect: () => startEditRoom(row as Room) },
                { label: t('rooms.renaming'), onSelect: () => openRenameModal(row as Room) },
                { destructive: true, label: t('common.delete'), onSelect: () => openDeleteDialog(() => { void rooms.remove(row.id) }) },
              ]}
              ariaLabel={t('common.actions')}
            />
          )
        ),
      },
    ]
    return cols
  }, [t, router, pathname, getTypeName, editingRoomId, roomEditStatus, saveEditRoom, savingEditRoom, startEditRoom, openRenameModal, openDeleteDialog, rooms])

  const typeColumns = useMemo(() => {
    const cols: TableColumn<RoomTypeRow>[] = [
      {
        key: 'name',
        label: t('common.name'),
        render: (_value, row) => (
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${getTypeColor(row.name)}`} />
            <span>{row.name}</span>
          </div>
        ),
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
              { label: t('common.edit'), onSelect: () => startEditType(row as RoomType) },
              { destructive: true, label: t('common.delete'), onSelect: () => openDeleteDialog(() => { void roomTypes.remove(row.id) }) },
            ]}
            ariaLabel={t('common.actions')}
          />
        ),
      },
    ]
    return cols
  }, [t, startEditType, roomTypes, openDeleteDialog])

  const renderSectionTabs = () => (
    <div className="overflow-x-auto -mx-4 px-4 scrollbar-none">
      <div className="flex items-center gap-2 w-max sm:w-auto">
        {(['overview', 'types', 'pricing'] as Section[]).map(s => (
          <button
            key={s}
            onClick={() => {
              setSection(s)
              const params = new URLSearchParams(searchParams.toString())
              params.set('section', s)
              router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            }}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              section === s
                ? 'bg-[#1A1A1A] text-white '
                : 'bg-white text-[#555555] hover:bg-[#F5F5F5] border border-[#EAEAEA]'
            }`}
          >
            {t(s === 'types' ? 'rooms.roomTypes' : `rooms.${s}`)}
          </button>
        ))}
      </div>
    </div>
  )

  const renderMetricsRow = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {[
        { label: t('rooms.totalRooms'), value: metrics.totalRooms },
        { label: t('rooms.roomTypes'), value: metrics.totalTypes },
        { label: t('rooms.availableRooms'), value: metrics.available },
        { label: t('rooms.avgPrice'), value: <MoneyAmount amount={metrics.avgPrice} /> },
      ].map(m => (
        <div key={m.label} className="bg-white rounded-xl border border-[#EAEAEA] p-3 sm:p-4 ">
          <div className="text-[10px] sm:text-xs font-medium text-[#787774] uppercase tracking-wide">{m.label}</div>
          <div className="mt-1 text-xl sm:text-2xl font-semibold text-[#1A1A1A] tabular-nums">{m.value}</div>
        </div>
      ))}
    </div>
  )

  const renderQuickAddBar = () => (
    <div className="bg-[#F9F9F8] rounded-xl p-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-[#787774] mb-1">{t('rooms.roomNumber')}</label>
          <input
            value={quickNumber}
            onChange={e => setQuickNumber(e.target.value)}
            placeholder="101"
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#787774] mb-1">{t('rooms.floor')}</label>
          <input
            type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
            min={0}
            value={quickFloor}
            onChange={e => setQuickFloor(Number(e.target.value))}
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-[#787774] mb-1">{t('rooms.type')}</label>
          <select
            value={quickTypeId}
            onChange={e => setQuickTypeId(e.target.value)}
            className="w-full rounded-lg border border-[#D4D4D4] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <option value="">{t('rooms.selectType')}</option>
            {roomTypes.items.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleQuickAdd}
          disabled={!quickNumber || !quickTypeId || quickAdding}
          className="w-full sm:w-auto rounded-lg bg-[#1A1A1A] px-5 py-2 text-sm font-medium text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
        >
          {quickAdding ? t('rooms.adding') : t('common.add')}
        </button>
      </div>
    </div>
  )

  const renderRoomTypeEmptyState = () => (
    <div className="bg-white rounded-xl border border-[#EAEAEA] p-12 text-center">
      <div className="text-4xl mb-3">🏗️</div>
      <h3 className="text-lg font-medium text-[#1A1A1A]">{t('rooms.noRoomTypes')}</h3>
      <p className="mt-1 text-sm text-[#787774]">{t('rooms.createTypeFirst')}</p>
      <button
        onClick={() => setSection('types')}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] transition-colors"
      >
        {t('rooms.newRoomType')}
      </button>
    </div>
  )

  const renderOverviewSection = () => (
    <div className="space-y-5">
      {renderMetricsRow()}
      {renderQuickAddBar()}
      <div className="flex justify-end">
        <button
          onClick={openBulkModal}
          className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] transition-colors"
        >
          + {t('rooms.bulkAdd')}
        </button>
      </div>
      {!roomTypes.items.length && renderRoomTypeEmptyState()}
      {roomTypes.items.length > 0 && !rooms.items.length && (
        <div className="bg-white rounded-xl border border-[#EAEAEA] p-12 text-center">
          <div className="text-4xl mb-3">🛏️</div>
          <h3 className="text-lg font-medium text-[#1A1A1A]">{t('rooms.noRooms')}</h3>
          <p className="mt-1 text-sm text-[#787774]">{t('rooms.addRoomHint')}</p>
        </div>
      )}
      {rooms.items.length > 0 && (
        <>
          <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <ToolbarSearch
                value={overQuery}
                onChange={setOverQuery}
                placeholder={t('rooms.searchRooms')}
              />
            </div>
            <ToolbarViewToggle
              view={overViewMode}
              onChange={setOverViewMode}
              rowLabel={t('rooms.pricingForm.tableView')}
              gridLabel={t('rooms.pricingForm.gridView')}
            />
          </div>
          {overViewMode === 'row' ? (
            <Table
              columns={roomColumns}
              data={filteredRooms as RoomRow[]}
              paginate={false}
              sortable={false}
              getRowId={(row) => row.id}
            />
          ) : (
            <GridView<Room>
              items={filteredRooms}
              getKey={(r) => r.id}
              renderItem={(r) => (
                <div className="relative group">
                  <button
                    onClick={() => openRenameModal(r)}
                    className="w-full text-left rounded-xl border border-[#EAEAEA] bg-white p-4  hover: transition-shadow cursor-pointer"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-[#1A1A1A]">{t('rooms.roomLabel')} {r.number}</span>
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(r.status)}`}>
                          {t(`rooms.${r.status}`)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-[#787774]">{t('rooms.floor')}</span>
                          <p className="font-medium text-[#1A1A1A]">{r.floor}</p>
                        </div>
                        <div>
                          <span className="text-[#787774]">{t('rooms.type')}</span>
                          <p className="font-medium text-[#1A1A1A] flex items-center gap-1.5">
                            <span className={`inline-block h-2.5 w-2.5 rounded-full ${getTypeColorById(r.roomTypeId)}`} />
                            {getTypeName(r.roomTypeId)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[#787774]">{t('rooms.price')}</span>
                          <p className="font-mono font-semibold text-[#1A1A1A]">
                            {formatCurrency(getEffectivePrice(r.roomTypeId, r.price))}
                          </p>
                        </div>
                        <div>
                          <span className="text-[#787774]">{t('rooms.capacity')}</span>
                          <p className="font-medium text-[#1A1A1A]">{r.capacity} {t('rooms.guests')}</p>
                        </div>
                      </div>
                    </div>
                  </button>
                  {canDeleteRooms && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openDeleteDialog(() => { void rooms.remove(r.id) }) }}
                      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-[#FDEBEC] p-1.5 text-[#9F2F2D] hover:bg-[#FDEBEC] hover:text-[#9F2F2D]"
                      title={t('rooms.deleteRoom')}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            />
          )}
        </>
      )}
    </div>
  )

  const renderTypesSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1A1A1A]">{t('rooms.roomTypes')}</h3>
        <button
          onClick={openCreateType}
          className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] transition-colors"
        >
          + {t('rooms.newRoomType')}
        </button>
      </div>

      <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <ToolbarSearch
            value={typesQuery}
            onChange={setTypesQuery}
            placeholder={t('rooms.searchTypes')}
          />
        </div>
        <ToolbarViewToggle
          view={typesViewMode}
          onChange={setTypesViewMode}
          rowLabel={t('rooms.pricingForm.tableView')}
          gridLabel={t('rooms.pricingForm.gridView')}
        />
      </div>

      {typesViewMode === 'row' ? (
        <Table
          columns={typeColumns}
          data={filteredTypes as RoomTypeRow[]}
          paginate={false}
          sortable={false}
          getRowId={(row) => row.id}
        />
      ) : (
        <GridView<RoomType>
          items={filteredTypes}
          getKey={(rt) => rt.id}
          renderItem={(rt) => (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-[#1A1A1A]">{rt.name}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="text-[#787774]">{t('rooms.capacity')}</span>
                  <p className="font-medium text-[#1A1A1A]">{rt.defaultCapacity} {t('rooms.guests')}</p>
                </div>
              </div>
            </div>
          )}
        />
      )}
    </div>
  )

  const renderPricingSection = () => (
    <PricingManagement />
  )

  const renderTypeFormModal = () => (
    <Modal
      isOpen={showTypeModal}
      onClose={closeTypeModal}
      title={editingTypeId ? t('common.edit') : t('rooms.newRoomType')}
      size="lg"
    >
      <form onSubmit={saveRoomType} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-[15px]">
          <div className="sm:col-span-2">
            <FloatingInput
              label={t('common.name')}
              value={typeForm.name}
              onChange={e => handleTypeNameChange(e.target.value)}
              required
            />
          </div>
          <FloatingInput
            label={t('rooms.capacity')}
            type="number" inputMode="numeric" step={1}
            min={1}
            value={typeForm.default_capacity}
            onChange={e => setTypeForm(f => ({ ...f, default_capacity: Number(e.target.value) }))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={closeTypeModal} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#F9F9F8] transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={savingRoomType} className="rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {savingRoomType ? t('common.saving') : (editingTypeId ? t('common.save') : t('common.create'))}
          </button>
        </div>
      </form>
    </Modal>
  )

  const renderBulkModal = () => (
    <Modal
      isOpen={showBulkModal}
      onClose={closeBulkModal}
      title={t('common.add')}
      size="lg"
    >
      <form onSubmit={handleBulkCreate} className="space-y-5 mt-[15px]">
        <FloatingInput
          label={t('rooms.totalRooms')}
          type="number" inputMode="numeric" step={1}
          min={1}
          value={bulkTotal}
          onChange={e => handleBulkTotalChange(Number(e.target.value))}
        />
        {roomTypes.items.length > 0 && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#333333]">{t('rooms.roomTypes')}</label>
            <div className="space-y-2">
              {roomTypes.items.map(rt => (
                <div key={rt.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-[#1A1A1A] flex-1">{rt.name}</span>
                  <input
                    type="number" inputMode="numeric" step={1} onWheel={(event) => event.currentTarget.blur()}
                    min={0}
                    value={bulkDistribution[rt.id] ?? 0}
                    onChange={e => handleBulkDistChange(rt.id, Number(e.target.value))}
                    className="w-20 rounded-lg border border-[#D4D4D4] px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              ))}
            </div>
            {bulkDistSum !== bulkTotal && (
              <p className="text-xs text-amber-600">
                {t('rooms.detail.failedUpdateStatus')}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={closeBulkModal} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#F9F9F8] transition-colors">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={bulkCreating || bulkDistSum !== bulkTotal}
            className="rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bulkCreating ? t('common.saving') : `${t('common.create')} ${bulkTotal}`}
          </button>
        </div>
      </form>
    </Modal>
  )

  const renderRenameModal = () => (
    <Modal
      isOpen={Boolean(renameRoom)}
      onClose={closeRenameModal}
      title={renameRoom ? `${t('common.edit')} ${t('rooms.roomNumber')} ${renameRoom.number.startsWith('TEMP') ? '-' : renameRoom.number}` : ''}
      size="md"
    >
      <form onSubmit={saveRename} className="space-y-5">
        <FloatingInput
          label={t('rooms.roomNumber')}
          value={renameNumber}
          onChange={e => setRenameNumber(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={closeRenameModal} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#F9F9F8] transition-colors">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!renameNumber.trim() || savingRename}
            className="rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingRename ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )

  const allError = rooms.error || roomTypes.error
  if (allError) {
    return <div className="bg-[#FDEBEC] rounded-xl p-6 text-[#9F2F2D] text-sm">{allError}</div>
  }

  return (
    <div className="space-y-6">
      {renderSectionTabs()}
      {section === 'overview' && renderOverviewSection()}
      {section === 'types' && renderTypesSection()}
      {section === 'pricing' && renderPricingSection()}

      {renderTypeFormModal()}
      {renderBulkModal()}
      {renderRenameModal()}
      <DeleteConfirmationDialog
        isOpen={Boolean(deleteAction)}
        title={t('common.confirmDeleteTitle')}
        description={t('common.confirmDeleteDescription')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.confirmDeleteAction')}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

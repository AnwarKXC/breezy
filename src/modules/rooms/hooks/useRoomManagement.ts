'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { useCurrency } from '@/shared/contexts/CurrencyContext'
import { useAdminRooms } from './useAdminRooms'
import { useRoomTypes } from '@/modules/room-types/hooks'
import { usePricing } from '@/modules/pricing/hooks'
import type { Room, CreateRoomInput, UpdateRoomInput } from '../types'
import type { CreateRoomTypeInput, UpdateRoomTypeInput } from '@/modules/room-types/types'
import type { CreatePricingInput, UpdatePricingInput } from '@/modules/pricing/types'
import type { RoomTypePricing } from '@/modules/pricing/types'
import type { RoomType } from '@/modules/room-types/types'
import type { CurrencyCode } from '@/shared'
import { toast } from '@/shared/toast/toastEvents'

export type Section = 'overview' | 'types' | 'pricing'

export interface TypeFormState {
  name: string
  slug: string
  base_price: number
  default_capacity: number
}

export interface PricingFormState {
  room_type_id: string
  price: number
  currency: CurrencyCode
  effective_from: string
  effective_until: string
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

function toSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function hasDateOverlap(
  aFrom: string | null,
  aUntil: string | null,
  bFrom: string | null,
  bUntil: string | null,
): boolean {
  const aStartBeforeBEnd = !aFrom || !bUntil || aFrom <= bUntil
  const bStartBeforeAEnd = !bFrom || !aUntil || bFrom <= aUntil
  return aStartBeforeBEnd && bStartBeforeAEnd
}

function isValidSection(s: string | null): s is Section {
  return s === 'overview' || s === 'types' || s === 'pricing'
}

export function useRoomManagement() {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rooms = useAdminRooms()
  const roomTypes = useRoomTypes()
  const pricing = usePricing()

  const [section, rawSetSection] = useState<Section>(() => {
    const s = searchParams.get('section')
    return isValidSection(s) ? s : 'overview'
  })

  const setSection = useCallback((s: Section) => {
    rawSetSection(s)
    const params = new URLSearchParams(searchParams.toString())
    params.set('section', s)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  const [quickNumber, setQuickNumber] = useState('')
  const [quickFloor, setQuickFloor] = useState(1)
  const [quickTypeId, setQuickTypeId] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)

  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [roomEditStatus, setRoomEditStatus] = useState<Room['status']>('available')
  const [roomEditPrice, setRoomEditPrice] = useState(0)

  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [typeForm, setTypeForm] = useState<TypeFormState>({ name: '', slug: '', base_price: 0, default_capacity: 2 })

  const [showPricingModal, setShowPricingModal] = useState(false)
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null)
  const [pricingForm, setPricingForm] = useState<PricingFormState>({ room_type_id: '', price: 0, currency: 'EGP' as CurrencyCode, effective_from: '', effective_until: '' })
  const [pricingError, setPricingError] = useState('')

  const [overViewMode, setOverViewMode] = useState<'row' | 'grid'>('row')
  const [typesViewMode, setTypesViewMode] = useState<'row' | 'grid'>('row')
  const [pricingViewMode, setPricingViewMode] = useState<'row' | 'grid'>('row')
  const [overQuery, setOverQuery] = useState('')
  const [typesQuery, setTypesQuery] = useState('')
  const [pricingQuery, setPricingQuery] = useState('')
  const [deleteAction, setDeleteAction] = useState<null | (() => void)>(null)

  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkTotal, setBulkTotal] = useState(1)
  const [bulkDistribution, setBulkDistribution] = useState<Record<string, number>>({})
  const [bulkCreating, setBulkCreating] = useState(false)

  const [renameRoom, setRenameRoom] = useState<Room | null>(null)
  const [renameNumber, setRenameNumber] = useState('')

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

  const handleBulkCreate = useCallback(async () => {
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

  const saveRename = useCallback(async () => {
    if (!renameRoom || !renameNumber.trim()) return
    await rooms.update(renameRoom.id, { number: renameNumber } as UpdateRoomInput)
    closeRenameModal()
  }, [renameRoom, renameNumber, rooms, closeRenameModal])

  const getEffectivePrice = useCallback((roomTypeId: string, defaultPrice: number) => {
    const now = new Date().toISOString()
    const active = pricing.items.find(p =>
      p.roomTypeId === roomTypeId &&
      (!p.effectiveFrom || p.effectiveFrom <= now) &&
      (!p.effectiveUntil || p.effectiveUntil >= now)
    )
    return active ? active.price : defaultPrice
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

  const filteredPricing = useMemo(() => {
    if (!pricingQuery) return pricing.items
    const q = pricingQuery.toLowerCase()
    return pricing.items.filter(p =>
      getTypeName(p.roomTypeId).toLowerCase().includes(q) ||
      p.currency.toLowerCase().includes(q)
    )
  }, [pricing.items, pricingQuery, getTypeName])

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
    if (!editingRoomId) return
    await rooms.update(editingRoomId, { status: roomEditStatus, price: roomEditPrice } as UpdateRoomInput)
    setEditingRoomId(null)
  }, [editingRoomId, roomEditStatus, roomEditPrice, rooms])

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

  const saveRoomType = useCallback(async () => {
    if (!typeForm.name) return
    if (editingTypeId) {
      await roomTypes.update(editingTypeId, typeForm as UpdateRoomTypeInput)
    } else {
      await roomTypes.create(typeForm as unknown as CreateRoomTypeInput)
    }
    closeTypeModal()
  }, [typeForm, editingTypeId, roomTypes, closeTypeModal])

  const openCreatePricing = useCallback(() => {
    setEditingPricingId(null)
    setPricingForm({ room_type_id: '', price: 0, currency: 'EGP', effective_from: '', effective_until: '' })
    setShowPricingModal(true)
  }, [])

  const startEditPricing = useCallback((p: RoomTypePricing) => {
    setEditingPricingId(p.id)
    setPricingForm({
      room_type_id: p.roomTypeId,
      price: p.price,
      currency: p.currency as CurrencyCode,
      effective_from: p.effectiveFrom ?? '',
      effective_until: p.effectiveUntil ?? '',
    })
    setShowPricingModal(true)
  }, [])

  const closePricingModal = useCallback(() => {
    setShowPricingModal(false)
    setEditingPricingId(null)
    setPricingForm({ room_type_id: '', price: 0, currency: 'EGP', effective_from: '', effective_until: '' })
    setPricingError('')
  }, [])

  const savePricing = useCallback(async () => {
    const effectiveFrom = pricingForm.effective_from ? `${pricingForm.effective_from}T00:00:00.000Z` : null
    const effectiveUntil = pricingForm.effective_until ? `${pricingForm.effective_until}T00:00:00.000Z` : null

    const overlap = pricing.items.find(p =>
      p.roomTypeId === pricingForm.room_type_id &&
      p.id !== editingPricingId &&
      hasDateOverlap(effectiveFrom, effectiveUntil, p.effectiveFrom, p.effectiveUntil)
    )
    if (overlap) {
      setPricingError(
        `This period overlaps with an existing rate for ${getTypeName(pricingForm.room_type_id)}`
      )
      return
    }
    setPricingError('')

    const input = {
      room_type_id: pricingForm.room_type_id,
      price: pricingForm.price,
      currency: pricingForm.currency,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil,
    }
    if (editingPricingId) {
      await pricing.update(editingPricingId, input as UpdatePricingInput)
    } else {
      await pricing.create(input as CreatePricingInput)
    }
    closePricingModal()
  }, [pricingForm, editingPricingId, pricing, closePricingModal, getTypeName])

  const statusBadgeClass = useCallback((status: string) => {
    switch (status) {
      case 'available': return 'bg-[#EDF3EC] text-[#346538] border border-emerald-200'
      case 'occupied': return 'bg-blue-50 text-blue-700 border border-blue-200'
      case 'maintenance': return 'bg-[#FBF3DB] text-[#956400] border border-amber-200'
      case 'cleaning': return 'bg-[#F9F9F8] text-[#555555] border border-[#EAEAEA]'
      default: return 'bg-[#F9F9F8] text-[#555555] border border-[#EAEAEA]'
    }
  }, [])

  const allError = rooms.error || roomTypes.error || pricing.error

  return {
    t,
    formatCurrency,
    section,
    setSection,
    rooms,
    roomTypes,
    pricing,
    quickNumber,
    setQuickNumber,
    quickFloor,
    setQuickFloor,
    quickTypeId,
    setQuickTypeId,
    quickAdding,
    handleQuickAdd,
    editingRoomId,
    setEditingRoomId,
    roomEditStatus,
    setRoomEditStatus,
    roomEditPrice,
    setRoomEditPrice,
    startEditRoom,
    saveEditRoom,
    showTypeModal,
    editingTypeId,
    typeForm,
    setTypeForm,
    openCreateType,
    startEditType,
    closeTypeModal,
    saveRoomType,
    handleTypeNameChange,
    showPricingModal,
    editingPricingId,
    pricingForm,
    setPricingForm,
    pricingError,
    setPricingError,
    openCreatePricing,
    startEditPricing,
    closePricingModal,
    savePricing,
    overViewMode,
    setOverViewMode,
    typesViewMode,
    setTypesViewMode,
    pricingViewMode,
    setPricingViewMode,
    overQuery,
    setOverQuery,
    typesQuery,
    setTypesQuery,
    pricingQuery,
    setPricingQuery,
    deleteAction,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
    showBulkModal,
    openBulkModal,
    closeBulkModal,
    bulkTotal,
    handleBulkTotalChange,
    bulkDistribution,
    handleBulkDistChange,
    bulkDistSum,
    handleBulkCreate,
    bulkCreating,
    renameRoom,
    renameNumber,
    setRenameNumber,
    openRenameModal,
    closeRenameModal,
    saveRename,
    getEffectivePrice,
    getTypeName,
    getTypeColorById,
    statusBadgeClass,
    metrics,
    filteredRooms,
    filteredTypes,
    filteredPricing,
    allError,
  }
}

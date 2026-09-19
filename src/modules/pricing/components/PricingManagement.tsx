'use client'

import { useState, useCallback, useMemo, type FormEvent } from 'react'
import { useTranslation } from '@/i18n/hooks/useTranslation'
import { Table, TableActionsMenu, type TableColumn } from '@/shared/table'
import { Modal, DropdownSelect, FloatingInput, GridView, DeleteConfirmationDialog, type CurrencyCode, CURRENCY_LABELS } from '@/shared'
import { ToolbarSearch, ToolbarViewToggle } from '@/shared/components/toolbar'
import { PricingCreateSchema } from '@/shared/validation'
import { usePricing } from '../hooks'
import { useRoomTypes } from '@/modules/room-types/hooks'
import type { CreatePricingInput, UpdatePricingInput } from '../types'
import type { RoomTypePricing } from '../types'
import { useCurrency } from '@/shared/contexts/CurrencyContext'

const currencyOptions = (Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map(code => ({
  label: CURRENCY_LABELS[code],
  value: code,
}))

export function PricingManagement() {
  const { t } = useTranslation()
  const { formatCurrency } = useCurrency()
  const pricing = usePricing()
  const roomTypes = useRoomTypes()

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ room_type_id: '', price: 0, price_single: 0, price_double: 0, price_triple: 0, currency: 'EGP' as CurrencyCode, effective_from: '', effective_until: '' })
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'row' | 'grid'>('row')
  const [query, setQuery] = useState('')
  const [deleteAction, setDeleteAction] = useState<null | (() => void)>(null)

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

  const getTypeName = useCallback((typeId: string) =>
    roomTypes.items.find(rt => rt.id === typeId)?.name ?? typeId,
  [roomTypes.items])

  const isStandard = useCallback((p: RoomTypePricing) => {
    return !p.effectiveFrom && !p.effectiveUntil
  }, [])

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

  const openCreate = useCallback(() => {
    setEditingId(null)
    setForm({ room_type_id: '', price: 0, price_single: 0, price_double: 0, price_triple: 0, currency: 'EGP', effective_from: '', effective_until: '' })
    setFormError('')
    setFieldErrors({})
    setShowModal(true)
  }, [])

  const startEdit = useCallback((p: RoomTypePricing) => {
    setEditingId(p.id)
    setForm({
      room_type_id: p.roomTypeId,
      price: p.price,
      price_single: p.priceSingle ?? 0,
      price_double: p.priceDouble ?? 0,
      price_triple: p.priceTriple ?? 0,
      currency: p.currency as CurrencyCode,
      effective_from: p.effectiveFrom ? p.effectiveFrom.slice(0, 10) : '',
      effective_until: p.effectiveUntil ? p.effectiveUntil.slice(0, 10) : '',
    })
    setFormError('')
    setFieldErrors({})
    setShowModal(true)
  }, [])

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }, [])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditingId(null)
    setForm({ room_type_id: '', price: 0, price_single: 0, price_double: 0, price_triple: 0, currency: 'EGP', effective_from: '', effective_until: '' })
    setFormError('')
    setFieldErrors({})
  }, [])

  const save = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setFieldErrors({})
    setFormError('')
    const effectiveFrom = form.effective_from ? `${form.effective_from}T00:00:00.000Z` : null
    const effectiveUntil = form.effective_until ? `${form.effective_until}T00:00:00.000Z` : null

    const input = {
      room_type_id: form.room_type_id,
      price: form.price,
      price_single: form.price_single || undefined,
      price_double: form.price_double || undefined,
      price_triple: form.price_triple || undefined,
      currency: form.currency,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil,
    }
    const parsed = PricingCreateSchema.safeParse(input)
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0])
        if (!field || errors[field]) continue
        errors[field] = field === 'room_type_id'
          ? t('rooms.selectType')
          : issue.message
      }
      setFieldErrors(errors)
      return
    }

    if (!form.price && !form.price_single && !form.price_double && !form.price_triple) {
      setFormError('At least one price is required')
      return
    }
    const overlap = pricing.items.find(p =>
      p.roomTypeId === form.room_type_id &&
      p.id !== editingId &&
      hasDateOverlap(effectiveFrom, effectiveUntil, p.effectiveFrom, p.effectiveUntil)
    )
    if (overlap) {
      setFormError(
        `This period overlaps with an existing rate for ${getTypeName(form.room_type_id)}`
      )
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await pricing.update(editingId, input as UpdatePricingInput)
      } else {
        await pricing.create(input as CreatePricingInput)
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }, [form, editingId, pricing, closeModal, getTypeName, saving, t])

  const filteredPricing = useMemo(() => {
    if (!query) return pricing.items
    const q = query.toLowerCase()
    return pricing.items.filter(p =>
      getTypeName(p.roomTypeId).toLowerCase().includes(q) ||
      p.currency.toLowerCase().includes(q)
    )
  }, [pricing.items, query, getTypeName])

  type PricingRow = RoomTypePricing & Record<string, unknown>

  const columns = useMemo(() => {
    const cols: TableColumn<PricingRow>[] = [
      {
        key: 'roomTypeId',
        label: t('rooms.type'),
        render: (_value, row) => <span className="font-medium">{getTypeName(row.roomTypeId)}</span>,
      },
      {
        key: 'price',
        label: t('rooms.pricingForm.standard'),
        render: (_value, row) => <span className="font-mono tabular-nums">{formatCurrency(row.price)}</span>,
      },
      {
        key: 'priceSingle',
        label: 'S',
        render: (_value, row) => (
          <span className="font-mono tabular-nums text-[#787774]">{row.priceSingle != null ? formatCurrency(row.priceSingle) : '—'}</span>
        ),
      },
      {
        key: 'priceDouble',
        label: 'D',
        render: (_value, row) => (
          <span className="font-mono tabular-nums text-[#787774]">{row.priceDouble != null ? formatCurrency(row.priceDouble) : '—'}</span>
        ),
      },
      {
        key: 'priceTriple',
        label: 'T',
        render: (_value, row) => (
          <span className="font-mono tabular-nums text-[#787774]">{row.priceTriple != null ? formatCurrency(row.priceTriple) : '—'}</span>
        ),
      },
      {
        key: 'effectiveFrom',
        label: t('rooms.pricingForm.periodLabel'),
        render: (_value, row) => (
          <span className="text-[#787774] text-xs">
            {row.effectiveFrom ? `${String(row.effectiveFrom).slice(0, 10)} — ${row.effectiveUntil ? String(row.effectiveUntil).slice(0, 10) : '∞'}` : t('rooms.pricingForm.standardBadge')}
          </span>
        ),
      },
      {
        key: 'id',
        label: t('common.actions'),
        render: (_value, row) => (
          <TableActionsMenu
            actions={[
              { label: t('common.edit'), onSelect: () => startEdit(row as RoomTypePricing) },
              { destructive: true, label: t('common.delete'), onSelect: () => openDeleteDialog(() => { void pricing.remove(row.id) }) },
            ]}
            ariaLabel={t('common.actions')}
          />
        ),
      },
    ]
    return cols
  }, [t, getTypeName, formatCurrency, startEdit, pricing, openDeleteDialog])

  const renderFormModal = () => (
    <Modal
      isOpen={showModal}
      onClose={closeModal}
      title={editingId ? t('common.edit') : t('rooms.newRate')}
      size="lg"
    >
      <form className="space-y-5" onSubmit={save}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-[15px]">
          <div className="floating-field is-filled">
            <DropdownSelect
              ariaLabel={t('rooms.type')}
              options={[
                { label: t('rooms.selectType'), value: '' },
                ...roomTypes.items.map(rt => ({ label: rt.name, value: rt.id })),
              ]}
              value={form.room_type_id}
              onChange={value => { clearFieldError('room_type_id'); setForm(f => ({ ...f, room_type_id: value })) }}
            />
            <span className="floating-label">{t('rooms.type')}</span>
            {fieldErrors.room_type_id && <p className="text-sm text-[#9F2F2D] mt-1">{fieldErrors.room_type_id}</p>}
          </div>
          <div className="floating-field is-filled">
            <DropdownSelect
              ariaLabel={t('rooms.pricingForm.currency')}
              options={currencyOptions}
              value={form.currency}
              onChange={currency => setForm(f => ({ ...f, currency }))}
            />
            <span className="floating-label">{t('rooms.pricingForm.currency')}</span>
          </div>

          <div className="sm:col-span-2 border-b border-[#EAEAEA] pb-1">
            <span className="text-xs font-semibold text-[#787774] uppercase tracking-wide">{t('rooms.pricingForm.occupancyPrices')}</span>
          </div>

          <div className="relative">
            <FloatingInput
              label={t('rooms.pricingForm.standard')}
              type="number"
              dir="ltr" inputMode="decimal"
              min={0}
              step="0.01"
              value={form.price}
              onChange={e => { clearFieldError('price'); setForm(f => ({ ...f, price: Number(e.target.value) })) }}
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#787774] pointer-events-none">{t('rooms.pricingForm.perNight')}</span>
            {fieldErrors.price && <p className="text-sm text-[#9F2F2D] mt-1">{fieldErrors.price}</p>}
          </div>
          <div className="relative">
            <FloatingInput
              label={t('rooms.pricingForm.single')}
              type="number"
              min={0}
              step="0.01"
              value={form.price_single}
              onChange={e => { clearFieldError('price_single'); setForm(f => ({ ...f, price_single: Number(e.target.value) })) }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#787774] pointer-events-none">{t('rooms.pricingForm.perNight')}</span>
            {fieldErrors.price_single && <p className="text-sm text-[#9F2F2D] mt-1">{fieldErrors.price_single}</p>}
          </div>
          <div className="relative">
            <FloatingInput
              label={t('rooms.pricingForm.double')}
              type="number"
              min={0}
              step="0.01"
              value={form.price_double}
              onChange={e => { clearFieldError('price_double'); setForm(f => ({ ...f, price_double: Number(e.target.value) })) }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#787774] pointer-events-none">{t('rooms.pricingForm.perNight')}</span>
            {fieldErrors.price_double && <p className="text-sm text-[#9F2F2D] mt-1">{fieldErrors.price_double}</p>}
          </div>
          <div className="relative">
            <FloatingInput
              label={t('rooms.pricingForm.triple')}
              type="number"
              min={0}
              step="0.01"
              value={form.price_triple}
              onChange={e => { clearFieldError('price_triple'); setForm(f => ({ ...f, price_triple: Number(e.target.value) })) }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-[#787774] pointer-events-none">{t('rooms.pricingForm.perNight')}</span>
            {fieldErrors.price_triple && <p className="text-sm text-[#9F2F2D] mt-1">{fieldErrors.price_triple}</p>}
          </div>

          <div className="sm:col-span-2 border-b border-[#EAEAEA] pb-1 mt-1">
            <span className="text-xs font-semibold text-[#787774] uppercase tracking-wide">{t('rooms.pricingForm.periodHint')}</span>
          </div>

          <div>
            <FloatingInput
              label={t('rooms.detail.from')}
              type="date" max={form.effective_until || undefined}
              value={form.effective_from}
              onChange={e => { clearFieldError('effective_from'); setForm(f => ({ ...f, effective_from: e.target.value })) }}
            />
            {fieldErrors.effective_from && <p className="text-sm text-[#9F2F2D] mt-1">{fieldErrors.effective_from}</p>}
          </div>
          <div>
            <FloatingInput
              label={t('rooms.detail.to')}
              type="date" min={form.effective_from || undefined}
              value={form.effective_until}
              onChange={e => { clearFieldError('effective_until'); setForm(f => ({ ...f, effective_until: e.target.value })) }}
            />
            {fieldErrors.effective_until && <p className="text-sm text-[#9F2F2D] mt-1">{fieldErrors.effective_until}</p>}
          </div>
        </div>
        {formError && (
          <p className="text-sm text-[#9F2F2D] bg-[#FDEBEC] rounded-lg px-3 py-2">{formError}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={closeModal} className="rounded-lg border border-[#D4D4D4] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#F9F9F8] transition-colors">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? t('common.saving') : (editingId ? t('common.save') : t('common.create'))}
          </button>
        </div>
      </form>
    </Modal>
  )

  if (pricing.error) {
    return <div className="bg-[#FDEBEC] rounded-xl p-6 text-[#9F2F2D] text-sm">{pricing.error}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#1A1A1A]">{t('rooms.pricing')}</h3>
        <button
          onClick={openCreate}
          className="rounded-lg bg-[#1A1A1A] px-4 py-2 text-sm font-medium text-white hover:bg-[#333333] transition-colors"
        >
          + {t('rooms.newRate')}
        </button>
      </div>

      <div className="flex flex-col gap-3 border-y border-[#EAEAEA] py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <ToolbarSearch
            value={query}
            onChange={setQuery}
            placeholder={t('rooms.pricingForm.search')}
          />
        </div>
        <ToolbarViewToggle
          view={viewMode}
          onChange={setViewMode}
          rowLabel={t('rooms.pricingForm.tableView')}
          gridLabel={t('rooms.pricingForm.gridView')}
        />
      </div>

      {viewMode === 'row' ? (
        <Table
          columns={columns}
          data={filteredPricing as PricingRow[]}
          paginate={false}
          sortable={false}
          getRowId={(row) => row.id}
          emptyMessage={t('rooms.pricingForm.empty')}
        />
      ) : (
        <GridView<RoomTypePricing>
          items={filteredPricing}
          getKey={(p) => p.id}
          renderItem={(p) => {
            const std = isStandard(p)
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-[#1A1A1A]">{getTypeName(p.roomTypeId)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${std ? 'bg-[#EDF3EC] text-[#346538]' : 'bg-[#F9F9F8] text-[#787774]'}`}>
                    {std ? t('rooms.pricingForm.standardBadge') : t('rooms.pricingForm.seasonalBadge')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[#787774]">{t('rooms.pricingForm.standardBadge')}</span>
                    <p className="font-mono font-semibold text-[#1A1A1A]">{formatCurrency(p.price)}</p>
                  </div>
                  <div>
                    <span className="text-[#787774]">{t('rooms.pricingForm.sdtLabel')}</span>
                    <p className="font-mono text-[#1A1A1A]">
                      <span className={p.priceSingle != null ? '' : 'text-[#D4D4D4]'}>{p.priceSingle != null ? formatCurrency(p.priceSingle) : '—'}</span>
                      {' / '}
                      <span className={p.priceDouble != null ? '' : 'text-[#D4D4D4]'}>{p.priceDouble != null ? formatCurrency(p.priceDouble) : '—'}</span>
                      {' / '}
                      <span className={p.priceTriple != null ? '' : 'text-[#D4D4D4]'}>{p.priceTriple != null ? formatCurrency(p.priceTriple) : '—'}</span>
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#787774]">{t('rooms.pricingForm.periodLabel')}</span>
                    <p className="font-medium text-[#1A1A1A]">
                      {p.effectiveFrom ? `${String(p.effectiveFrom).slice(0, 10)} — ${p.effectiveUntil ? String(p.effectiveUntil).slice(0, 10) : '∞'}` : t('rooms.pricingForm.alwaysActive')}
                    </p>
                  </div>
                </div>
              </div>
            )
          }}
        />
      )}

      {renderFormModal()}
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

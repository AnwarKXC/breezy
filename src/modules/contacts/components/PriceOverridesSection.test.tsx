import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriceOverridesSection } from './PriceOverridesSection'
import type { CompanyPriceOverride } from '../types'

const labels = {
  priceOverridesTitle: 'Price Overrides',
  priceOverridesDescription: 'Set custom prices for this company',
  roomCategory: 'Room Category',
  actions: 'Actions',
  savingOverrides: 'Saving...',
  saveOverrides: 'Save',
}

const overrides: CompanyPriceOverride[] = [
  { id: 'o1', contactId: 'c1', roomCategory: 'standard', occupancyCode: 'S', price: 100 },
  { id: 'o2', contactId: 'c1', roomCategory: 'standard', occupancyCode: 'D', price: 150 },
]

const roomTypes = [
  { slug: 'standard', name: 'Standard', basePrice: 80 },
  { slug: 'deluxe', name: 'Deluxe', basePrice: 150 },
]

describe('PriceOverridesSection', () => {
  it('shows editable inputs when canEdit is true', () => {
    render(
      <PriceOverridesSection overrides={overrides} roomTypes={roomTypes} canEdit onSave={vi.fn()} labels={labels} />,
    )
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('shows read-only prices when canEdit is false', () => {
    render(
      <PriceOverridesSection overrides={overrides} roomTypes={roomTypes} canEdit={false} onSave={vi.fn()} labels={labels} />,
    )
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
    expect(screen.getByText('$100')).toBeInTheDocument()
  })

  it('shows default base price when no override exists', () => {
    render(
      <PriceOverridesSection overrides={[]} roomTypes={roomTypes} canEdit={false} onSave={vi.fn()} labels={labels} />,
    )
    expect(screen.getAllByText('$80')).toHaveLength(3)
    expect(screen.getAllByText('$150')).toHaveLength(3)
  })

  it('save button appears per row when canEdit is true', () => {
    render(
      <PriceOverridesSection overrides={overrides} roomTypes={roomTypes} canEdit onSave={vi.fn()} labels={labels} />,
    )
    const saveButtons = screen.getAllByText('Save')
    expect(saveButtons.length).toBeGreaterThan(0)
  })
})

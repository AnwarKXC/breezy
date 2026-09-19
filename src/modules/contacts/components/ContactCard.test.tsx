import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactCard } from './ContactCard'
import type { Contact } from '../types'

const labels = {
  edit: 'Edit',
  delete: 'Delete',
  phone: 'Phone',
  country: 'Country',
  city: 'City',
  responsiblePerson: 'Responsible',
  createdAt: 'Created',
  actions: 'Actions',
  company: 'Company',
  individual: 'Individual',
}

const companyContact: Contact = {
  id: '1',
  type: 'company',
  name: 'Acme Corp',
  phone: '+1234567890',
  email: 'info@acme.com',
  logo: '/logos/acme.png',
  country: 'US',
  city: 'New York',
  responsiblePerson: 'John Doe',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
}

const individualContact: Contact = {
  id: '2',
  type: 'individual',
  name: 'Jane Doe',
  phone: '+9876543210',
  email: 'jane@example.com',
  idPassport: 'PP123456',
  createdAt: '2024-02-01T00:00:00Z',
  updatedAt: '2024-02-02T00:00:00Z',
}

describe('ContactCard', () => {
  it('shows company fields', () => {
    render(<ContactCard contact={companyContact} labels={labels} />)
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText(/New York, US/)).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows individual fields without company-specific fields', () => {
    render(<ContactCard contact={individualContact} labels={labels} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.queryByText('US')).not.toBeInTheDocument()
  })

  it('calls onRowClick when card is clicked', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(<ContactCard contact={companyContact} labels={labels} onRowClick={onRowClick} />)
    const name = screen.getByText('Acme Corp')
    await user.click(name)
    expect(onRowClick).toHaveBeenCalledWith(companyContact)
  })
})

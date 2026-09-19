import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContactsTable } from './ContactsTable'
import type { Contact } from '../types'

const labels = {
  name: 'Name',
  type: 'Type',
  phone: 'Phone',
  email: 'Email',
  country: 'Country',
  city: 'City',
  createdAt: 'Created',
  actions: 'Actions',
  edit: 'Edit',
  delete: 'Delete',
}

const contacts: Contact[] = [
  {
    id: '1',
    type: 'company',
    name: 'Acme Corp',
    phone: '+1234567890',
    email: 'info@acme.com',
    logo: '/logos/acme.png',
    country: 'US',
    city: 'New York',
    responsiblePerson: 'John',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: '2',
    type: 'individual',
    name: 'Jane Doe',
    phone: '+9876543210',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-02T00:00:00Z',
  },
]

describe('ContactsTable', () => {
  it('renders contact rows', () => {
    render(<ContactsTable contacts={contacts} labels={labels} />)
    const names = screen.getAllByText('Acme Corp')
    expect(names.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0)
  })

  it('shows logo image when available', () => {
    render(<ContactsTable contacts={contacts} labels={labels} />)
    const logos = screen.getAllByAltText('')
    expect(logos.length).toBeGreaterThan(0)
    expect(logos[0]).toHaveAttribute('src', '/logos/acme.png')
  })

  it('shows initial when no logo', () => {
    const noLogoContacts = [contacts[1]]
    render(<ContactsTable contacts={noLogoContacts} labels={labels} />)
    const initials = screen.getAllByText('J')
    expect(initials.length).toBeGreaterThan(0)
  })

  it('calls onRowClick when a row is clicked', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(<ContactsTable contacts={contacts} labels={labels} onRowClick={onRowClick} />)

    const name = screen.getAllByText('Acme Corp')[0]
    await user.click(name)
    expect(onRowClick).toHaveBeenCalledWith(contacts[0])
  })
})

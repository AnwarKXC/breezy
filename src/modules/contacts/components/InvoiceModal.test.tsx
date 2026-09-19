import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InvoiceModal } from './InvoiceModal'
import type { Invoice } from '../types/invoiceTypes'

const invoice: Invoice = {
  id: 'inv1',
  contactId: 'c1',
  invoiceNumber: 'INV-001',
  amount: 500,
  status: 'paid',
  issueDate: '2024-01-01',
  dueDate: '2024-02-01',
  paidAt: '2024-01-15',
  notes: 'Payment received',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
}

const labels = {
  invoice: 'Invoice',
  invoiceNumber: 'Invoice #',
  amount: 'Amount',
  status: 'Status',
  issueDate: 'Issue Date',
  dueDate: 'Due Date',
  paidAt: 'Paid At',
  notes: 'Notes',
  close: 'Close',
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

describe('InvoiceModal', () => {
  it('shows invoice details', () => {
    render(<InvoiceModal invoice={invoice} labels={labels} onClose={vi.fn()} />)
    expect(screen.getByText('INV-001')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    expect(screen.getByText('2024-01-01')).toBeInTheDocument()
  })

  it('closes on Escape key', async () => {
    const onClose = vi.fn()
    render(<InvoiceModal invoice={invoice} labels={labels} onClose={onClose} />)
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes on overlay click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(<InvoiceModal invoice={invoice} labels={labels} onClose={onClose} />)
    const overlay = container.firstChild as HTMLElement
    expect(overlay).toBeInTheDocument()
    await user.click(overlay)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('close button works', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<InvoiceModal invoice={invoice} labels={labels} onClose={onClose} />)
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    await user.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

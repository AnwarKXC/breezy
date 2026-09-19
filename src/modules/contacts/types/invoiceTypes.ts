export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface Invoice {
  id: string
  contactId: string
  invoiceNumber: string
  amount: number
  currency?: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  paidAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInvoiceInput {
  contactId: string
  invoiceNumber: string
  amount: number
  dueDate: string
  notes?: string
}

export interface UpdateInvoiceInput {
  id: string
  amount?: number
  status?: InvoiceStatus
  dueDate?: string
  paidAt?: string | null
  notes?: string | null
}

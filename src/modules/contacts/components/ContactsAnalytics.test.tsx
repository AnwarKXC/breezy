import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContactsAnalytics } from './ContactsAnalytics'

const labels = {
  total: 'Total',
  company: 'Companies',
  individual: 'Individuals',
}

describe('ContactsAnalytics', () => {
  it('shows loading skeletons when loading', () => {
    const { container } = render(
      <ContactsAnalytics loading metrics={{ total: 0, company: 0, individual: 0 }} labels={labels} />,
    )
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })

  it('shows metric values', () => {
    render(
      <ContactsAnalytics metrics={{ total: 100, company: 60, individual: 40 }} labels={labels} />,
    )
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText('40')).toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContactsLoadingState, ContactsStateCard } from './ContactsStates'

describe('ContactsLoadingState', () => {
  it('renders skeleton rows', () => {
    const { container } = render(<ContactsLoadingState />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(10)
  })
})

describe('ContactsStateCard', () => {
  it('shows title and description', () => {
    render(<ContactsStateCard title="No contacts" description="Create your first contact" />)
    expect(screen.getByText('No contacts')).toBeInTheDocument()
    expect(screen.getByText('Create your first contact')).toBeInTheDocument()
  })

  it('shows only title when no description', () => {
    render(<ContactsStateCard title="Loading..." />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })
})

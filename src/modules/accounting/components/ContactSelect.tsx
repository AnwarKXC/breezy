'use client'

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type UIEvent } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { useClickOutside } from '@/shared/hooks/useClickOutside'
import { fetchContacts, fetchContactById } from '@/modules/contacts/services/contactsApiClient'
import type { Contact } from '@/modules/contacts/types'

interface Props {
  value: string
  onChange: (id: string) => void
  onSelectContact?: (contact: Contact | null) => void
  label?: string
  required?: boolean
}

const CONTACT_LOOKUP_PAGE_SIZE = 10

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
      <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-[#787774]" fill="none" viewBox="0 0 24 24">
      <path d="M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-indigo-600" />
    </div>
  )
}

function mergeContacts(existing: Contact[], incoming: Contact[]) {
  const seen = new Set(existing.map((contact) => contact.id))
  return [
    ...existing,
    ...incoming.filter((contact) => {
      if (seen.has(contact.id)) return false
      seen.add(contact.id)
      return true
    }),
  ]
}

export function ContactSelect({ value, onChange, onSelectContact, label, required }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const requestSeqRef = useRef(0)
  const debouncedQuery = useDebounce(query, 300)
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setOpen(false))

  const selectedContact = contacts.find((c) => c.id === value) ?? null

  const loadContactsPage = useCallback(async (options: {
    search: string
    cursor?: string | null
    append?: boolean
  }) => {
    const requestId = ++requestSeqRef.current
    const append = Boolean(options.append)

    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setHasMore(false)
      setNextCursor(null)
    }

    try {
      const result = await fetchContacts({
        cursor: options.cursor,
        limit: CONTACT_LOOKUP_PAGE_SIZE,
        search: options.search || undefined,
      })
      if (requestId !== requestSeqRef.current) return

      setContacts((current) => append ? mergeContacts(current, result.data) : result.data)
      setHasMore(result.hasMore)
      setNextCursor(result.nextCursor)
      if (!append) setHighlightIdx(-1)
    } catch {
      if (requestId === requestSeqRef.current && !append) {
        setContacts([])
        setHasMore(false)
        setNextCursor(null)
      }
    } finally {
      if (requestId === requestSeqRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!open) return
    void loadContactsPage({ search: debouncedQuery.trim() })
  }, [debouncedQuery, loadContactsPage, open])

  useEffect(() => {
    if (!value) return
    if (selectedContact) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedName(selectedContact.name)
      return
    }
    let cancelled = false
    fetchContactById(value).then((contact) => {
      if (!cancelled && contact) {
        setSelectedName(contact.name)
      }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleSelect = useCallback((contact: Contact) => {
    onChange(contact.id)
    onSelectContact?.(contact)
    setSelectedName(contact.name)
    setQuery('')
    setOpen(false)
  }, [onChange, onSelectContact])

  const handleClear = useCallback(() => {
    onChange('')
    onSelectContact?.(null)
    setSelectedName('')
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }, [onChange, onSelectContact])

  const handleFocus = useCallback(() => {
    setOpen(true)
    setQuery('')
    setContacts([])
    setHasMore(false)
    setNextCursor(null)
    setHighlightIdx(-1)
    setLoading(true)
  }, [])

  const handleInputChange = useCallback((value: string) => {
    setQuery(value)
    setOpen(true)
    setContacts([])
    setHasMore(false)
    setNextCursor(null)
    setHighlightIdx(-1)
    setLoading(true)
  }, [])

  const handleListScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom > 32 || loading || loadingMore || !hasMore || !nextCursor) return
    void loadContactsPage({
      append: true,
      cursor: nextCursor,
      search: debouncedQuery.trim(),
    })
  }, [debouncedQuery, hasMore, loadContactsPage, loading, loadingMore, nextCursor])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.min(prev + 1, contacts.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && highlightIdx >= 0 && highlightIdx < contacts.length) {
      e.preventDefault()
      handleSelect(contacts[highlightIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [open, contacts, highlightIdx, handleSelect])

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll<HTMLButtonElement>('[role="option"]')
      items[highlightIdx]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIdx])

  const name = selectedContact?.name ?? selectedName

  return (
    <div ref={dropdownRef} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-[#333333]">
          {label}
          {required && <span className="ml-1 text-[#9F2F2D]">*</span>}
        </label>
      )}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
          <SearchIcon />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="form-control contact-select-input w-full"
          placeholder={name || 'Search contacts...'}
          value={open ? query : name}
          onFocus={handleFocus}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {value && !open && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 end-0 flex items-center pe-2 text-[#787774] hover:text-[#555555]"
            tabIndex={-1}
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        )}
      </div>
      {selectedContact && !open && (
        <div className="mt-1 flex items-center gap-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            selectedContact.type === 'company'
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {selectedContact.type === 'company' ? 'Company' : 'Individual'}
          </span>
          {selectedContact.phone && (
            <span className="text-xs text-[#787774]">{selectedContact.phone}</span>
          )}
        </div>
      )}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[#EAEAEA] bg-white text-sm shadow-[0_18px_40px_rgba(16,26,36,0.14)]"
        >
          {loading && contacts.length === 0 ? (
            <LoadingSpinner />
          ) : debouncedQuery && contacts.length === 0 ? (
            <p className="px-3 py-4 text-center text-[#787774]">No contacts found</p>
          ) : contacts.length === 0 ? (
            <p className="px-3 py-4 text-center text-[#787774]">No contacts found</p>
          ) : (
            <div className="max-h-60 overflow-y-auto p-1" onScroll={handleListScroll}>
              {contacts.map((contact, idx) => {
                const active = contact.id === value
                const highlighted = idx === highlightIdx
                return (
                  <button
                    key={contact.id}
                    role="option"
                    aria-selected={active}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                      highlighted ? 'bg-indigo-50' : active ? 'bg-[#F9F9F8]' : 'hover:bg-[#F9F9F8]'
                    }`}
                    onClick={() => handleSelect(contact)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-[#1A1A1A]">{contact.name}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          contact.type === 'company'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {contact.type === 'company' ? 'Co' : 'Ind'}
                        </span>
                      </div>
                      {contact.phone && (
                        <p className="truncate text-xs text-[#787774]">{contact.phone}</p>
                      )}
                    </div>
                    {active && <CheckIcon />}
                  </button>
                )
              })}
              {loadingMore && (
                <div className="py-2">
                  <LoadingSpinner />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { toast } from '@/shared/toast/toastEvents'
import { CONTACTS_PAGE_SIZE, CONTACTS_PAGE_SIZE_OPTIONS } from '../constants'
import { deleteContact as deleteContactApi, fetchContacts, fetchContactsMetrics } from '../services/contactsApiClient'
import type { Contact, ContactType, ContactsMetrics } from '../types'

type ViewMode = 'row' | 'grid'
type TypeFilter = ContactType | 'all'

export function useContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [view, setView] = useState<ViewMode>('row')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(CONTACTS_PAGE_SIZE)
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined])
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<ContactsMetrics>({ total: 0, company: 0, individual: 0 })
  const [mutationVersion, setMutationVersion] = useState(0)
  const debouncedQuery = useDebounce(query.trim(), 300)
const MAX_PAGE_JUMP = 20

  useEffect(() => {
    const cursor = cursorStack[page - 1]
    let ignore = false
    const doFetch = async () => {
      try {
        const result = await fetchContacts({ cursor, limit: pageSize, type: type === 'all' ? undefined : type, search: debouncedQuery || undefined })
        if (ignore) return
        setContacts(result.data)
        setHasMore(result.hasMore)
        setTotal(result.total ?? 0)
        setNextCursor(result.nextCursor)
        setError(null)
      } catch {
        if (!ignore) setError('contacts/request_failed')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    doFetch()
    return () => { ignore = true }
  }, [cursorStack, page, debouncedQuery, pageSize, type, mutationVersion])

  useEffect(() => {
    void fetchContactsMetrics().then(setMetrics).catch(() => undefined)
  }, [mutationVersion])

  const resetPagination = useCallback(() => {
    setCursorStack([undefined])
    setPage(1)
  }, [])

  const nextPage = useCallback(() => {
    if (!hasMore || !nextCursor) return
    setCursorStack((prev) => { const next = prev.slice(0, page); next[page] = nextCursor; return next.length > 100 ? next.slice(-100) : next })
    setPage((prev) => prev + 1)
  }, [hasMore, nextCursor, page])

  const previousPage = useCallback(() => setPage((prev) => Math.max(1, prev - 1)), [])

  const goToPage = useCallback(async (p: number) => {
    const maxPages = Math.max(1, Math.ceil(total / pageSize))
    if (p < 1 || p > maxPages) return
    const jump = Math.abs(p - cursorStack.length)
    if (jump > MAX_PAGE_JUMP) return
    const cursors = cursorStack.slice()
    for (let i = cursors.length; i < p; i++) {
      const res = await fetchContacts({ cursor: cursors[i - 1], limit: pageSize, type: type === 'all' ? undefined : type, search: debouncedQuery || undefined })
      if (!res.nextCursor) return
      cursors[i] = res.nextCursor
    }
    setCursorStack(cursors.length > 100 ? cursors.slice(-100) : cursors)
    setPage(p)
  }, [cursorStack, debouncedQuery, pageSize, total, type])

  const deleteContact = useCallback(async (id: string) => {
    try {
      await deleteContactApi(id)
      toast.success('Contact deleted')
      setMutationVersion((v) => v + 1)
    } catch {
      toast.error('Operation failed')
    }
  }, [])

  const triggerMutation = useCallback(() => setMutationVersion((v) => v + 1), [])

  return {
    contacts, loading, error, query, type, view, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    hasMore, nextCursor, metrics,
    canNext: hasMore && Boolean(nextCursor),
    canPrevious: page > 1,
    nextPage, previousPage, goToPage,
    setQuery: (value: string) => { setQuery(value); setLoading(true); resetPagination() },
    setType: (value: TypeFilter) => { setType(value); setLoading(true); resetPagination() },
    setPageSize: (value: number) => { setPageSize(value); setLoading(true); resetPagination() },
    setView, deleteContact, triggerMutation,
    pageSizeOptions: CONTACTS_PAGE_SIZE_OPTIONS,
  }
}

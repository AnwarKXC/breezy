'use client'

import { useCallback, useEffect, useEffectEvent, useSyncExternalStore } from 'react'

/**
 * Tiny stale-while-revalidate cache for client reads.
 *
 * - Data survives route changes, so revisiting a page renders cached rows at
 *   once and revalidates them in the background (every mount revalidates once
 *   the entry is older than `staleMs`, which only dedupes mount bursts).
 * - Concurrent requests for the same key share one fetch.
 * - Entries are immutable snapshots, read through useSyncExternalStore.
 */
interface Entry<T> {
  data?: T
  error?: Error
  fetching: boolean
  updatedAt: number
}

type Listener = () => void

const DEFAULT_STALE_MS = 2_000

const entries = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<Listener>>()

function setEntry<T>(key: string, patch: Partial<Entry<T>>) {
  const prev = (entries.get(key) as Entry<T> | undefined) ?? { fetching: false, updatedAt: 0 }
  entries.set(key, { ...prev, ...patch })
  listeners.get(key)?.forEach((listener) => listener())
}

function subscribe(key: string, listener: Listener) {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

/** Fetches `key` (deduplicated) and stores the result. Never rejects. */
export function loadResource<T>(key: string, fetcher: () => Promise<T>): Promise<T | undefined> {
  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending.catch(() => undefined)

  const promise = fetcher()
  inflight.set(key, promise)
  setEntry<T>(key, { fetching: true })

  return promise
    .then((data) => {
      setEntry<T>(key, { data, error: undefined, fetching: false, updatedAt: Date.now() })
      return data
    })
    .catch((error: unknown) => {
      setEntry<T>(key, { error: error instanceof Error ? error : new Error(String(error)), fetching: false })
      return undefined
    })
    .finally(() => {
      inflight.delete(key)
    })
}

/** Replaces cached data locally (optimistic updates after a mutation). */
export function mutateResource<T>(key: string, update: (current: T | undefined) => T) {
  const current = entries.get(key) as Entry<T> | undefined
  setEntry<T>(key, { data: update(current?.data), updatedAt: Date.now() })
}

/** Marks entries whose key starts with `prefix` stale so the next read refetches. */
export function invalidateResources(prefix: string) {
  for (const [key, entry] of entries) {
    if (key.startsWith(prefix)) entries.set(key, { ...entry, updatedAt: 0 })
  }
}

const noopSubscribe = () => () => {}

export interface ResourceState<T> {
  data: T | undefined
  error: Error | undefined
  /** No data yet and a request is (or is about to be) in flight. */
  isLoading: boolean
  /** Any request in flight, including background revalidation. */
  isFetching: boolean
  /** When the current data was fetched (ms epoch), if ever. */
  updatedAt: number | undefined
  refresh: () => Promise<T | undefined>
  mutate: (update: (current: T | undefined) => T) => void
}

export function useResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  { staleMs = DEFAULT_STALE_MS }: { staleMs?: number } = {},
): ResourceState<T> {
  const entry = useSyncExternalStore(
    key ? (listener) => subscribe(key, listener) : noopSubscribe,
    () => (key ? (entries.get(key) as Entry<T> | undefined) : undefined),
    () => undefined,
  )

  const fetchLatest = useEffectEvent(() => (key ? loadResource(key, fetcher) : Promise.resolve(undefined)))

  useEffect(() => {
    if (!key) return
    const current = entries.get(key)
    if (!current || Date.now() - current.updatedAt > staleMs) void fetchLatest()
  }, [key, staleMs])

  const refresh = useCallback(
    () => (key ? loadResource(key, fetcher) : Promise.resolve(undefined)),
    [key, fetcher],
  )
  const mutate = useCallback(
    (update: (current: T | undefined) => T) => {
      if (key) mutateResource(key, update)
    },
    [key],
  )

  return {
    data: entry?.data,
    error: entry?.error,
    isLoading: key !== null && entry?.data === undefined && !entry?.error,
    isFetching: entry?.fetching ?? false,
    updatedAt: entry?.data === undefined ? undefined : entry.updatedAt || undefined,
    refresh,
    mutate,
  }
}

/** GETs a JSON API route and unwraps its `{ data }` envelope. Throws on non-2xx. */
export async function fetchData<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = (await res.json().catch(() => null)) as { data?: T; error?: unknown } | null
  if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : `Request failed (${res.status})`)
  return body?.data as T
}

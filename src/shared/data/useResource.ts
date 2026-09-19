'use client'

import { useCallback, useEffect, useEffectEvent, useSyncExternalStore } from 'react'

/**
 * Tiny stale-while-revalidate cache for client reads.
 *
 * - Data survives route changes, so revisiting a page renders cached rows at
 *   once and revalidates them in the background (every mount revalidates once
 *   the entry is older than `staleMs`, which only dedupes mount bursts).
 * - Mount-time loads of the same key share one request; an explicit refresh
 *   always starts a new one, and a response never overwrites newer data.
 * - Entries are immutable snapshots, read through useSyncExternalStore.
 */
interface Entry<T> {
  data?: T
  error?: Error
  fetching: boolean
  updatedAt: number
  /** Bumped by every local mutation; responses requested before it are dropped. */
  version: number
}

type Listener = () => void

const DEFAULT_STALE_MS = 2_000

const entries = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<Listener>>()

function getEntry<T>(key: string): Entry<T> {
  return (entries.get(key) as Entry<T> | undefined) ?? { fetching: false, updatedAt: 0, version: 0 }
}

function setEntry<T>(key: string, patch: Partial<Entry<T>>) {
  entries.set(key, { ...getEntry<T>(key), ...patch })
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

/**
 * Fetches `key` and stores the result. Never rejects. Without `force`, joins a
 * request already in flight; with it, supersedes that request.
 */
export function loadResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  { force = false }: { force?: boolean } = {},
): Promise<T | undefined> {
  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending && !force) return pending.catch(() => undefined)

  const promise = fetcher()
  const version = getEntry<T>(key).version
  inflight.set(key, promise)
  setEntry<T>(key, { fetching: true })

  // Only the latest request may write, and never over a newer local mutation.
  const isLatest = () => inflight.get(key) === promise
  const canApply = () => isLatest() && getEntry<T>(key).version === version

  return promise
    .then((data) => {
      if (canApply()) setEntry<T>(key, { data, error: undefined, updatedAt: Date.now() })
      return data
    })
    .catch((error: unknown) => {
      if (canApply()) setEntry<T>(key, { error: error instanceof Error ? error : new Error(String(error)) })
      return undefined
    })
    .finally(() => {
      if (!isLatest()) return
      inflight.delete(key)
      setEntry<T>(key, { fetching: false })
    })
}

/** Replaces cached data locally (optimistic updates after a mutation). */
export function mutateResource<T>(key: string, update: (current: T | undefined) => T) {
  const current = getEntry<T>(key)
  setEntry<T>(key, { data: update(current.data), error: undefined, updatedAt: Date.now(), version: current.version + 1 })
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
  /** Starts a fresh request (never reuses one begun before a mutation). */
  refresh: () => Promise<T | undefined>
  mutate: (update: (current: T | undefined) => T) => void
}

export function useResource<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  { staleMs = DEFAULT_STALE_MS }: { staleMs?: number } = {},
): ResourceState<T> {
  const subscribeToKey = useCallback(
    (listener: Listener) => (key ? subscribe(key, listener) : noopSubscribe()),
    [key],
  )
  const entry = useSyncExternalStore(
    subscribeToKey,
    () => (key ? (entries.get(key) as Entry<T> | undefined) : undefined),
    () => undefined,
  )

  const fetchLatest = useEffectEvent((force: boolean) =>
    key ? loadResource(key, fetcher, { force }) : Promise.resolve(undefined),
  )

  useEffect(() => {
    if (!key) return
    const current = entries.get(key)
    if (!current || Date.now() - current.updatedAt > staleMs) void fetchLatest(false)
  }, [key, staleMs])

  const refresh = useCallback(
    () => (key ? loadResource(key, fetcher, { force: true }) : Promise.resolve(undefined)),
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
    updatedAt: entry?.data === undefined ? undefined : entry.updatedAt,
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

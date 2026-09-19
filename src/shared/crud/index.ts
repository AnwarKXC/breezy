import { toast } from '@/shared/toast/toastEvents'

const inFlightRequests = new Map<string, Promise<unknown>>()

function inFlightKey(url: string, init?: RequestInit): string {
  return `${init?.method ?? 'GET'}:${url}`
}

type QueryValue = string | number | boolean | null | undefined

export type CrudQueryParams = Record<string, QueryValue | readonly QueryValue[]>
export type CrudToastOptions = false | {
  errorMessage?: string
  successMessage?: string
}

interface ApiResponseEnvelope<T> {
  data: T
  message?: string
}

interface ApiResponseMessage {
  message: string
}

export interface CrudClientOptions {
  defaultError?: string
  endpoint: string
  toast?: CrudToastOptions
}

export interface CrudRequestOptions extends RequestInit {
  query?: CrudQueryParams
  toast?: CrudToastOptions
}

export interface CrudClient<
  Entity,
  CreateInput = Partial<Entity>,
  UpdateInput = Partial<Entity>,
  ListResponse = Entity[],
  ListParams = CrudQueryParams,
> {
  create(input: CreateInput): Promise<Entity>
  delete<DeleteResponse = void>(id: string): Promise<DeleteResponse>
  getById(id: string): Promise<Entity>
  list(params?: ListParams): Promise<ListResponse>
  request<T>(path?: string, options?: CrudRequestOptions): Promise<T>
  update(id: string, input: UpdateInput): Promise<Entity>
}

function normalizeEndpoint(endpoint: string) {
  return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
}

function appendQuery(params: URLSearchParams, key: string, value: QueryValue) {
  if (value === null || value === undefined || value === '') return
  params.append(key, String(value))
}

export function createEndpointUrl(
  endpoint: string,
  path = '',
  query?: CrudQueryParams,
) {
  const base = `${normalizeEndpoint(endpoint)}${path}`
  if (!query) return base

  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => appendQuery(params, key, item))
      return
    }

    appendQuery(params, key, value as QueryValue)
  })

  const queryString = params.toString()
  return queryString ? `${base}?${queryString}` : base
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return Boolean(data && typeof data === 'object')
}

function isApiResponseEnvelope<T>(data: unknown): data is ApiResponseEnvelope<T> {
  if (!isRecord(data) || !('data' in data)) return false
  const keys = Object.keys(data)
  return keys.every((k) => k === 'data' || k === 'message')
}

function hasApiResponseMessage(data: unknown): data is ApiResponseMessage {
  return Boolean(isRecord(data) && typeof data.message === 'string' && data.message.trim())
}

export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  defaultError = 'crud/request_failed',
  toastOptions: CrudToastOptions = false,
): Promise<T> {
  const method = init.method ?? 'GET'

  if (method === 'GET') {
    const key = inFlightKey(url, init)
    const existing = inFlightRequests.get(key) as Promise<T> | undefined
    if (existing) return existing

    const promise = actualFetch<T>(url, init, defaultError, toastOptions)
    inFlightRequests.set(key, promise)
    promise.finally(() => { inFlightRequests.delete(key) })
    return promise
  }

  return actualFetch<T>(url, init, defaultError, toastOptions)
}

async function actualFetch<T>(
  url: string,
  init: RequestInit,
  defaultError: string,
  toastOptions: CrudToastOptions,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })
  } catch (error) {
    if (toastOptions !== false) {
      toast.error(toastOptions.errorMessage ?? 'Network error', {
        description: 'Check your connection and try again.',
      })
    }
    throw error
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.error ?? defaultError
    if (toastOptions !== false) {
      toast.error(toastOptions.errorMessage ?? 'Operation failed', { description: message })
    }
    throw new Error(message)
  }

  const successMessage = hasApiResponseMessage(data)
    ? data.message
    : toastOptions === false
      ? undefined
      : toastOptions.successMessage

  if (toastOptions !== false && successMessage) {
    toast.success(successMessage)
  }

  return isApiResponseEnvelope<T>(data) ? data.data : data as T
}

export function createCrudApiClient<
  Entity,
  CreateInput = Partial<Entity>,
  UpdateInput = Partial<Entity>,
  ListResponse = Entity[],
  ListParams = CrudQueryParams,
>(options: CrudClientOptions): CrudClient<Entity, CreateInput, UpdateInput, ListResponse, ListParams> {
  const endpoint = normalizeEndpoint(options.endpoint)
  const defaultError = options.defaultError ?? 'crud/request_failed'
  const defaultToast = options.toast ?? { errorMessage: 'Network error' }
  const mutationToast = defaultToast === false
    ? false
    : { ...defaultToast, successMessage: defaultToast.successMessage ?? 'Operation completed' }
  const idPath = (id: string) => `/${encodeURIComponent(id)}`

  return {
    create(input) {
      return requestJson<Entity>(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        defaultError,
        mutationToast,
      )
    },

    delete<DeleteResponse = void>(id: string) {
      return requestJson<DeleteResponse>(
        createEndpointUrl(endpoint, idPath(id)),
        { method: 'DELETE' },
        defaultError,
        mutationToast,
      )
    },

    getById(id) {
      return requestJson<Entity>(
        createEndpointUrl(endpoint, idPath(id)),
        undefined,
        defaultError,
        defaultToast,
      )
    },

    list(params) {
      return requestJson<ListResponse>(
        createEndpointUrl(endpoint, '', params as CrudQueryParams | undefined),
        { cache: 'no-cache' },
        defaultError,
        defaultToast,
      )
    },

    request<T>(path = '', requestOptions: CrudRequestOptions = {}) {
      const { query, toast: requestToast = defaultToast, ...init } = requestOptions
      return requestJson<T>(createEndpointUrl(endpoint, path, query), init, defaultError, requestToast)
    },

    update(id, input) {
      return requestJson<Entity>(
        createEndpointUrl(endpoint, idPath(id)),
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        },
        defaultError,
        mutationToast,
      )
    },
  }
}

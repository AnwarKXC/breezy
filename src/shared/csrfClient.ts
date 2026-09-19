function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_COOKIE_NAME = 'csrf-token'
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let installed = false

export function installCsrfHeaderPatch(): void {
  if (installed || typeof window === 'undefined' || typeof fetch === 'undefined') return
  installed = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url: string | null = null
    if (typeof input === 'string') url = input
    else if (input instanceof URL) url = input.toString()
    else if (input instanceof Request) url = input.url

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (url && method && MUTATION_METHODS.has(method)) {
      const isSameOriginApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)
      if (isSameOriginApi) {
        const token = readCookie(CSRF_COOKIE_NAME)
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
          if (!headers.has(CSRF_HEADER_NAME)) {
            headers.set(CSRF_HEADER_NAME, token)
          }
          init = { ...init, headers }
        }
      }
    }
    return originalFetch(input as RequestInfo, init)
  }
}
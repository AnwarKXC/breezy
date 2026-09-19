import { vi, type Mock } from 'vitest'

type ModelMock = Record<string, Mock>

const METHODS = [
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findMany', 'create', 'createMany', 'update',
  'updateMany', 'upsert', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy',
] as const

/**
 * Minimal Prisma client double for unit tests. Every model method is a vi.fn()
 * that resolves to null/[]/0 by default; `$transaction` runs callbacks against
 * the same mock and resolves arrays of promises.
 *
 *   const db = vi.hoisted(() => createPrismaMock())
 *   vi.mock('@/services/db/prisma', () => ({ prisma: db, withActor: (_: string, fn: (tx: unknown) => unknown) => fn(db) }))
 */
export function createPrismaMock() {
  const models = new Map<string, ModelMock>()

  const model = (): ModelMock => {
    const m: ModelMock = {}
    for (const method of METHODS) {
      m[method] = vi.fn(async () => (method === 'findMany' || method === 'groupBy' ? [] : method === 'count' ? 0 : null))
    }
    return m
  }

  const client: Record<string | symbol, unknown> = {
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(proxy) : Promise.all(arg as Promise<unknown>[]),
    ),
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: vi.fn(async () => []),
  }

  const proxy: Record<string, ModelMock> & typeof client = new Proxy(client, {
    get(target, key) {
      if (key in target) return target[key]
      if (typeof key !== 'string' || key === 'then') return undefined
      if (!models.has(key)) models.set(key, model())
      return models.get(key)
    },
  }) as never

  return proxy as unknown as Record<string, ModelMock> & {
    $transaction: Mock
    $executeRaw: Mock
    $queryRaw: Mock
  }
}

/** Restores every mocked method to its default implementation (vitest keeps the vi.fn(impl) body). */
export function resetPrismaMock() {
  vi.resetAllMocks()
}

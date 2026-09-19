import { vi } from 'vitest'

export const logContactCreated = vi.fn().mockResolvedValue(undefined)
export const logContactUpdated = vi.fn().mockResolvedValue(undefined)
export const logContactDeleted = vi.fn().mockResolvedValue(undefined)

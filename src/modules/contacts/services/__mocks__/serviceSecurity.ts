import { vi } from 'vitest'

export const requireContactsRead = vi.fn().mockResolvedValue(undefined)
export const requireContactsCreate = vi.fn().mockResolvedValue(undefined)
export const requireContactsUpdate = vi.fn().mockResolvedValue(undefined)
export const requireContactsDelete = vi.fn().mockResolvedValue(undefined)
export const requirePriceOverridesUpdate = vi.fn().mockResolvedValue(undefined)

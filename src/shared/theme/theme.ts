// Dashboard theme shared by server (CSS injection) and client (settings preview).

export const DEFAULT_PRIMARY_COLOR = '#1A1A1A'

export const PRIMARY_COLOR_PRESETS = ['#1A1A1A', '#2563EB', '#0F766E', '#15803D', '#B45309', '#BE123C', '#7C3AED'] as const

const HEX_COLOR = /^#[0-9A-F]{6}$/

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const upper = value.trim().toUpperCase()
  return HEX_COLOR.test(upper) ? upper : null
}

/** Readable text color on top of `hex` (WCAG relative luminance). */
export function foregroundFor(hex: string): string {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return luminance > 0.4 ? '#1A1A1A' : '#FFFFFF'
}

export function themeCssVars(primary: string): Record<string, string> {
  return { '--app-primary': primary, '--app-primary-foreground': foregroundFor(primary) }
}

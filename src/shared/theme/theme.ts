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
  const whiteContrast = 1.05 / (luminance + 0.05)
  if (whiteContrast >= 4.5) return '#FFFFFF'
  const inkLuminance = ((26 / 255 + 0.055) / 1.055) ** 2.4
  return (luminance + 0.05) / (inkLuminance + 0.05) >= 4.5 ? '#1A1A1A' : '#000000'
}

export function themeCssVars(primary: string): Record<string, string> {
  const foreground = foregroundFor(primary)
  return {
    '--app-primary': primary,
    '--app-primary-foreground': foreground,
    '--app-primary-hover': `color-mix(in srgb, ${primary} 85%, ${foreground === '#FFFFFF' ? '#000000' : '#FFFFFF'})`,
  }
}

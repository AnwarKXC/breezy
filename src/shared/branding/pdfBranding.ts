// Client-side: the organization identity as printed on PDFs (invoices, reports).
// Everything comes from Settings > Organization; nothing hotel-specific is hardcoded.

import { documentQr, type PublicBranding } from './branding'

export interface PdfBranding {
  name: string
  contactLines: string[]
  taxId: string
  /** PNG/JPEG data URI, or '' when the logo can't be embedded (pdfmake only takes PNG/JPEG). */
  logoDataUri: string
  qr: { value: string; caption: string } | null
  footer: string
}

async function fetchBranding(): Promise<PublicBranding | null> {
  try {
    const res = await fetch('/api/branding')
    if (!res.ok) return null
    return ((await res.json()) as { data?: PublicBranding }).data ?? null
  } catch {
    return null
  }
}

const logoDataUriPromises = new Map<string, Promise<string>>()

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// Cached per URL: a new upload gets a new file id, so a stale entry is never reused.
function loadLogoDataUri(url: string): Promise<string> {
  let promise = logoDataUriPromises.get(url)
  if (!promise) {
    promise = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error('Logo not found')
      const type = r.headers.get('content-type') ?? ''
      if (type !== 'image/png' && type !== 'image/jpeg') throw new Error('Unsupported logo type: ' + type)
      return `data:${type};base64,${arrayBufferToBase64(await r.arrayBuffer())}`
    })
    promise.catch(() => logoDataUriPromises.delete(url))
    logoDataUriPromises.set(url, promise)
  }
  return promise
}

export async function loadPdfBranding(): Promise<PdfBranding> {
  const branding = await fetchBranding()
  const logoDataUri = branding ? await loadLogoDataUri(branding.logoUrl).catch(() => '') : ''
  return {
    name: branding?.displayName ?? '',
    contactLines: branding
      ? [branding.email, branding.phones.join('  ·  '), branding.address].filter(Boolean)
      : [],
    taxId: branding?.taxId ?? '',
    logoDataUri,
    qr: branding ? documentQr(branding) : null,
    footer: branding?.invoiceFooter ?? '',
  }
}

/** pdfmake node: QR code with its caption, pinned to one side. */
export function pdfQrNode(qr: NonNullable<PdfBranding['qr']>, alignment: 'left' | 'right', color: string) {
  return {
    stack: [
      { qr: qr.value, fit: 64, foreground: color, alignment },
      ...(qr.caption ? [{ text: qr.caption, fontSize: 6.5, color, alignment, margin: [0, 2, 0, 0] }] : []),
    ],
    margin: [0, 0, 0, 8],
  }
}

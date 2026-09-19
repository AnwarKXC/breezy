'use client'

const MAX_BYTES = 5 * 1024 * 1024
const FILE_URL_PATTERN = /^\/api\/files\/([0-9a-f-]{36})$/i

/** Uploads a logo and returns the URL to store on the contact (/api/files/<id>). */
export async function uploadLogo(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error('File too large (max 5MB)')
  if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed')

  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/files', { method: 'POST', body })
  const json = (await res.json().catch(() => null)) as { data?: { url: string }; error?: string } | null
  if (!res.ok || !json?.data?.url) {
    throw new Error(json?.error === 'files/unsupported_type' ? 'Only PNG, JPEG, GIF or WebP images are allowed' : 'Logo upload failed')
  }
  return json.data.url
}

export async function deleteLogo(url: string): Promise<void> {
  const id = url.match(FILE_URL_PATTERN)?.[1]
  if (!id) return
  await fetch(`/api/files/${id}`, { method: 'DELETE' })
}

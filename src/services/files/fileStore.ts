import 'server-only'

import { prisma } from '@/services/db/prisma'

export const MAX_FILE_BYTES = 5 * 1024 * 1024

// Detect the real type from the file signature; the client-supplied MIME type
// is not trusted. SVG is intentionally not accepted (it can carry script).
const SIGNATURES: Array<{ type: string; test: (b: Uint8Array) => boolean }> = [
  { type: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/gif', test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    type: 'image/webp',
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
]

export function detectImageType(bytes: Uint8Array): string | null {
  return SIGNATURES.find((s) => s.test(bytes))?.type ?? null
}

export function fileUrl(id: string) {
  return `/api/files/${id}`
}

const FILE_URL_PATTERN = /^\/api\/files\/([0-9a-f-]{36})$/i

export function fileIdFromUrl(url: string | null | undefined): string | null {
  return url?.match(FILE_URL_PATTERN)?.[1] ?? null
}

export async function saveImage(bytes: Uint8Array, createdBy: string) {
  const contentType = detectImageType(bytes)
  if (!contentType) throw new Error('files/unsupported_type')
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_FILE_BYTES) throw new Error('files/too_large')

  const file = await prisma.files.create({
    data: { content_type: contentType, size_bytes: bytes.byteLength, data: Buffer.from(bytes), created_by: createdBy },
    select: { id: true },
  })
  return { id: file.id, url: fileUrl(file.id) }
}

export async function getFile(id: string) {
  return prisma.files.findUnique({ where: { id }, select: { content_type: true, data: true } })
}

export async function deleteFile(id: string) {
  await prisma.files.deleteMany({ where: { id } })
}

import path from 'node:path'
import {
  TRANSFORMED_DIR,
  VALID_BOOKING_STATUS,
  VALID_LOG_ACTIONS,
  VALID_LOG_MODULES,
  VALID_ROLES,
  ensureDir,
  getArg,
  nonEmptyString,
  readJson,
  sanitize,
  timestampToIso,
  writeJson,
} from './shared.mjs'

function role(value) {
  return VALID_ROLES.has(value) ? value : 'front_desk'
}

function bookingStatus(value) {
  return VALID_BOOKING_STATUS.has(value) ? value : 'pending'
}

function logAction(value) {
  return VALID_LOG_ACTIONS.has(value) ? value : null
}

function logModule(value) {
  return VALID_LOG_MODULES.has(value) ? value : null
}

function actorFromLog(data) {
  const actor = data.actor ?? {}
  const id = nonEmptyString(actor.id) ?? nonEmptyString(data.userId) ?? 'unknown'
  const email = nonEmptyString(actor.email)
  const name = nonEmptyString(actor.name) ?? nonEmptyString(data.userName) ?? email ?? id
  const actorRole = nonEmptyString(actor.role)

  return sanitize({
    id,
    ...(email ? { email } : {}),
    name,
    ...(actorRole ? { role: actorRole } : {}),
  })
}

function targetFromLog(data) {
  const target = data.target ?? {}
  const id = nonEmptyString(target.id) ?? nonEmptyString(data.entityId)
  const name = nonEmptyString(target.name)
  const email = nonEmptyString(target.email)
  const type = nonEmptyString(target.type) ?? nonEmptyString(data.entityType) ?? nonEmptyString(data.module)
  const targetRole = nonEmptyString(target.role)

  if (!id && !name && !email && !type && !targetRole) return null

  return sanitize({
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(type ? { type } : {}),
    ...(targetRole ? { role: targetRole } : {}),
  })
}

function descriptionFor(data, actor, target) {
  if (nonEmptyString(data.description)) return data.description
  const actorName = actor.name ?? actor.email ?? actor.id
  const targetName = target?.name ?? target?.email ?? target?.id ?? target?.type ?? data.module
  return `${actorName} ${String(data.action ?? '').replaceAll('_', ' ')} ${targetName}`
}

const inputFile = getArg('--input')
if (!inputFile) throw new Error('Usage: node transform.mjs --input=<export-file>')

const source = await readJson(inputFile)
await ensureDir(TRANSFORMED_DIR)

const users = source.users
  .map(({ id, data }) => ({
    external_firebase_id: id,
    name: nonEmptyString(data.name) ?? nonEmptyString(data.displayName) ?? nonEmptyString(data.email) ?? id,
    email: nonEmptyString(data.email)?.toLowerCase() ?? null,
    password: nonEmptyString(data.password) ?? null,
    phone: nonEmptyString(data.phone) ?? null,
    role: role(data.role),
    created_at: timestampToIso(data.createdAt) ?? timestampToIso(data.created_at) ?? new Date().toISOString(),
  }))
  .filter((user) => user.email)

const bookings = source.bookings
  .map(({ id, data }) => ({
    external_firebase_id: id,
    guest_id: String(data.guestId ?? data.guest_id ?? ''),
    guest_name: String(data.guestName ?? data.guest_name ?? ''),
    room_id: String(data.roomId ?? data.room_id ?? ''),
    room_number: String(data.roomNumber ?? data.room_number ?? ''),
    check_in: timestampToIso(data.checkIn ?? data.check_in),
    check_out: timestampToIso(data.checkOut ?? data.check_out),
    status: bookingStatus(data.status),
    total_amount: Number(data.totalAmount ?? data.total_amount ?? 0),
    paid_amount: Number(data.paidAmount ?? data.paid_amount ?? 0),
    created_at: timestampToIso(data.createdAt ?? data.created_at) ?? new Date().toISOString(),
    updated_at: timestampToIso(data.updatedAt ?? data.updated_at) ?? new Date().toISOString(),
  }))
  .filter((booking) => booking.guest_id && booking.room_id && booking.check_in && booking.check_out)

const logs = source.logs
  .map(({ id, data }) => {
    const action = logAction(data.action)
    const logModuleValue = logModule(data.module)
    const actor = actorFromLog(data)
    const target = targetFromLog(data)

    if (!action || !logModuleValue) return null

    return {
      external_firebase_id: id,
      action,
      module: logModuleValue,
      description: descriptionFor(data, actor, target),
      actor,
      target,
      metadata: data.metadata ? sanitize(data.metadata) : null,
      created_at: timestampToIso(data.createdAt ?? data.created_at) ?? new Date().toISOString(),
    }
  })
  .filter(Boolean)

const output = {
  sourceFile: inputFile,
  transformedAt: new Date().toISOString(),
  users,
  bookings,
  logs,
}

const file = path.join(TRANSFORMED_DIR, `supabase-import-${output.transformedAt.replaceAll(':', '-')}.json`)
await writeJson(file, output)

console.log(JSON.stringify({
  file,
  users: users.length,
  bookings: bookings.length,
  logs: logs.length,
}, null, 2))

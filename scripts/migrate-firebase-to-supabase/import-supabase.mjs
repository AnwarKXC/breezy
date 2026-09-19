import {
  chunk,
  getArg,
  hasFlag,
  initSupabase,
  readJson,
} from './shared.mjs'

const inputFile = getArg('--input')
const apply = hasFlag('--apply')

if (!inputFile) throw new Error('Usage: node import-supabase.mjs --input=<transformed-file> [--apply]')

const data = await readJson(inputFile)
const supabase = await initSupabase()
const summary = {
  dryRun: !apply,
  users: { createdAuth: 0, reusedAuth: 0, upsertedProfiles: 0, skipped: 0 },
  bookings: { upserted: 0, skipped: 0 },
  logs: { upserted: 0, skipped: 0 },
}

async function listAuthUsersByEmail() {
  const byEmail = new Map()
  let page = 1

  for (;;) {
    const { data: result, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const user of result.users) {
      if (user.email) byEmail.set(user.email.toLowerCase(), user)
    }
    if (result.users.length < 1000) break
    page += 1
  }

  return byEmail
}

async function migrateUsers() {
  const authByEmail = await listAuthUsersByEmail()

  for (const user of data.users) {
    if (!user.email) {
      summary.users.skipped += 1
      continue
    }

    let authUser = authByEmail.get(user.email)

    if (!authUser && apply) {
      const createPayload = {
        email: user.email,
        email_confirm: true,
        user_metadata: {
          display_name: user.name,
          name: user.name,
        },
        app_metadata: {
          firebase_uid: user.external_firebase_id,
          role: user.role,
        },
      }
      if (user.password && user.password.length >= 6) createPayload.password = user.password

      const { data: created, error } = await supabase.auth.admin.createUser(createPayload)
      if (error) throw error
      authUser = created.user
      authByEmail.set(user.email, authUser)
      summary.users.createdAuth += 1
    } else if (authUser) {
      summary.users.reusedAuth += 1
    }

    if (!authUser) {
      summary.users.skipped += 1
      continue
    }

    if (apply) {
      const { error } = await supabase.from('profiles').upsert({
        id: authUser.id,
        external_firebase_id: user.external_firebase_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at,
      }, { onConflict: 'id' })
      if (error) throw error
    }

    summary.users.upsertedProfiles += 1
  }
}

async function migrateBookings() {
  for (const batch of chunk(data.bookings, 100)) {
    const rows = batch.map((booking) => ({
      external_firebase_id: booking.external_firebase_id,
      guest_id: booking.guest_id,
      guest_name: booking.guest_name,
      room_id: booking.room_id,
      room_number: booking.room_number,
      check_in: booking.check_in,
      check_out: booking.check_out,
      status: booking.status,
      total_amount: booking.total_amount,
      paid_amount: booking.paid_amount,
      created_at: booking.created_at,
      updated_at: booking.updated_at,
    }))

    if (apply && rows.length) {
      const { error } = await supabase.from('bookings').upsert(rows, { onConflict: 'external_firebase_id' })
      if (error) throw error
    }
    summary.bookings.upserted += rows.length
  }
}

async function migrateLogs() {
  for (const batch of chunk(data.logs, 100)) {
    const rows = batch.map((log) => ({
      external_firebase_id: log.external_firebase_id,
      action: log.action,
      module: log.module,
      description: log.description,
      actor: log.actor,
      target: log.target,
      metadata: log.metadata,
      created_at: log.created_at,
    }))

    if (apply && rows.length) {
      const { error } = await supabase.from('audit_logs').upsert(rows, { onConflict: 'external_firebase_id' })
      if (error) throw error
    }
    summary.logs.upserted += rows.length
  }
}

await migrateUsers()
await migrateBookings()
await migrateLogs()

console.log(JSON.stringify(summary, null, 2))

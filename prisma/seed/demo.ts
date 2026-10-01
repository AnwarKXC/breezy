// Fake but realistic hotel data for developing/testing the AI assistant
// (and any report) against a DEVELOPMENT database. Never run on production:
// it inserts guests, reservations, invoices, payments and expenses.
//
//   pnpm db:seed && pnpm db:seed:demo -- --confirm-dev-database
//
// Covers the edge cases reports must handle: multiple currencies, cancelled and
// no-show stays, held bookings, fully / partially / un-paid and overdue invoices,
// deposits paid before arrival, refunds, company bookings with several rooms,
// repeat guests, past + in-house + future stays, draft/approved/paid expenses.
// Demo rows are recognisable: guest emails end with @demo.example, invoice
// numbers start with DEMO-.
import 'dotenv/config'

import { randomUUID } from 'node:crypto'

import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/services/db/prisma'

import { EXPENSE_CATEGORIES, ROOM_TYPES } from './data'

const DEMO_EMAIL_DOMAIN = '@demo.example'
const DAY = 86_400_000

// ---------------------------------------------------------------------------
// Deterministic randomness so every run produces the same dataset.
// ---------------------------------------------------------------------------
let seed = 20261002
function rand() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]
function weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
  let roll = rand() * entries.reduce((sum, [, w]) => sum + w, 0)
  for (const [value, weight] of entries) if ((roll -= weight) < 0) return value
  return entries[entries.length - 1][0]
}

const iso = (date: Date) => date.toISOString().slice(0, 10)
const day = (value: string) => new Date(`${value}T00:00:00.000Z`)
const addDays = (value: string, days: number) => iso(new Date(day(value).getTime() + days * DAY))
const money = (value: number) => Math.round(value * 100) / 100
const cairoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
const [SINGLE, DOUBLE, TRIPLE, SUITE] = ROOM_TYPES.map((t) => t.id)
const NIGHTLY_RATE: Record<string, Record<string, number>> = {
  EGP: { [SINGLE]: 1200, [DOUBLE]: 1800, [TRIPLE]: 2400, [SUITE]: 4200 },
  USD: { [SINGLE]: 30, [DOUBLE]: 45, [TRIPLE]: 60, [SUITE]: 110 },
  EUR: { [SINGLE]: 28, [DOUBLE]: 42, [TRIPLE]: 55, [SUITE]: 100 },
}
const CAPACITY: Record<string, number> = { [SINGLE]: 1, [DOUBLE]: 2, [TRIPLE]: 3, [SUITE]: 4 }

const ARABIC_FIRST = ['محمد', 'أحمد', 'محمود', 'مصطفى', 'عمر', 'يوسف', 'خالد', 'كريم', 'إبراهيم', 'حسن', 'فاطمة', 'مريم', 'نور', 'سارة', 'هبة', 'آية', 'منى', 'ياسمين', 'دينا', 'رنا']
const ARABIC_LAST = ['عبد الله', 'السيد', 'حسين', 'إبراهيم', 'علي', 'منصور', 'الشريف', 'سليمان', 'فؤاد', 'عثمان', 'رمضان', 'الجمال', 'زكي', 'نصار', 'شاكر']
const LATIN_FIRST = ['John', 'Emma', 'Lukas', 'Sophie', 'Marco', 'Anna', 'David', 'Laura', 'James', 'Olivia']
const LATIN_LAST = ['Smith', 'Müller', 'Rossi', 'Dubois', 'Johnson', 'Schmidt', 'Brown', 'Garcia']
const COMPANIES = [
  { name: 'شركة النيل للسياحة', city: 'Cairo' },
  { name: 'Delta Petroleum Services', city: 'Alexandria' },
  { name: 'مجموعة الأهرام للمقاولات', city: 'Giza' },
  { name: 'Red Sea Diving Center', city: 'Hurghada' },
  { name: 'البنك المصري للتنمية', city: 'Cairo' },
  { name: 'Sinai Tech Solutions', city: 'Sharm El Sheikh' },
  { name: 'Global Travel Agency', city: 'Cairo' },
  { name: 'شركة الدلتا للأدوية', city: 'Mansoura' },
] as const

// ---------------------------------------------------------------------------

function parseArgs() {
  if (!process.argv.includes('--confirm-dev-database')) {
    console.error(
      'Refusing to run: this inserts fake guests, reservations and payments.\n' +
        'Only run it against a development database, then pass --confirm-dev-database.',
    )
    process.exit(1)
  }
}

interface RoomRow {
  id: string
  number: string
  room_type_id: string
}

/** Keeps per-room booked nights so generated stays never overlap. */
class RoomCalendar {
  private readonly booked = new Map<string, Array<[string, string]>>()

  isFree(roomId: string, from: string, to: string) {
    return !(this.booked.get(roomId) ?? []).some(([a, b]) => from < b && a < to)
  }

  book(roomId: string, from: string, to: string) {
    const list = this.booked.get(roomId) ?? []
    list.push([from, to])
    this.booked.set(roomId, list)
  }
}

async function ensureRooms(): Promise<RoomRow[]> {
  const existing = await prisma.rooms.findMany({ where: { deleted_at: null }, select: { id: true, number: true, room_type_id: true } })
  if (existing.length) return existing

  const rooms: Prisma.roomsCreateManyInput[] = []
  for (const floor of [1, 2, 3]) {
    for (let n = 1; n <= 10; n++) {
      const typeId = floor === 1 ? (n <= 4 ? SINGLE : DOUBLE) : floor === 2 ? (n <= 6 ? DOUBLE : TRIPLE) : n <= 6 ? TRIPLE : SUITE
      rooms.push({ id: randomUUID(), number: `${floor}${String(n).padStart(2, '0')}`, floor, room_type_id: typeId, capacity: CAPACITY[typeId] })
    }
  }
  await prisma.rooms.createMany({ data: rooms })
  return rooms.map((r) => ({ id: r.id!, number: r.number, room_type_id: r.room_type_id }))
}

async function main() {
  parseArgs()

  if (await prisma.guests.count({ where: { email: { endsWith: DEMO_EMAIL_DOMAIN } } })) {
    console.log('Demo data already present (guests with @demo.example). Nothing to do.')
    return
  }
  const admin = await prisma.profiles.findFirst({ where: { role: 'admin', deleted_at: null }, select: { id: true } })
  if (!admin) throw new Error('No admin profile found. Run `pnpm admin:create` first.')
  const typesPresent = await prisma.room_types.count({ where: { id: { in: ROOM_TYPES.map((t) => t.id) } } })
  if (typesPresent !== ROOM_TYPES.length) throw new Error('Seeded room types are missing. Run `pnpm db:seed` first.')

  const today = cairoToday()
  const rooms = await ensureRooms()
  const calendar = new RoomCalendar()
  // Respect stays that already exist in this database.
  for (const rr of await prisma.reservation_rooms.findMany({
    where: { deleted_at: null, status: { in: ['held', 'reserved', 'occupied', 'checked_out'] } },
    select: { room_id: true, check_in_date: true, check_out_date: true },
  })) {
    calendar.book(rr.room_id, iso(rr.check_in_date), iso(rr.check_out_date))
  }

  // ---- companies -----------------------------------------------------------
  const companies = COMPANIES.map((c, i) => ({
    id: randomUUID(),
    type: 'company' as const,
    name: c.name,
    city: c.city,
    country: 'EG',
    phone: `+2023${String(5550000 + i).padStart(7, '0')}`,
    email: `billing${i + 1}${DEMO_EMAIL_DOMAIN}`,
    responsible_person: pick(ARABIC_FIRST),
  }))

  // ---- guests (+ one individual contact each, invoices need a contact) -----
  const guests: Prisma.guestsCreateManyInput[] = []
  const guestContacts: Prisma.contactsCreateManyInput[] = []
  const contactByGuest = new Map<string, string>()
  for (let i = 0; i < 100; i++) {
    const arabic = i < 80
    const first = arabic ? pick(ARABIC_FIRST) : pick(LATIN_FIRST)
    const last = arabic ? pick(ARABIC_LAST) : pick(LATIN_LAST)
    const country = arabic ? weighted([['EG', 85], ['SA', 8], ['AE', 7]] as const) : pick(['GB', 'DE', 'IT', 'FR', 'US'] as const)
    const phone = arabic ? `+2010${String(10000000 + i * 7919).slice(-8)}` : `+44${String(7700900000 + i)}`
    const id = randomUUID()
    guests.push({
      id,
      first_name: first,
      last_name: last,
      email: `guest${i + 1}${DEMO_EMAIL_DOMAIN}`,
      phone,
      country,
      passport_number: arabic ? null : `P${String(4000000 + i)}`,
      status: i % 23 === 0 ? 'vip' : 'active',
    })
    const contactId = randomUUID()
    guestContacts.push({ id: contactId, type: 'individual', name: `${first} ${last}`, phone, country, email: `guest${i + 1}${DEMO_EMAIL_DOMAIN}` })
    contactByGuest.set(id, contactId)
  }
  // A few loyal guests come back often (repeat-guest questions).
  const guestPool = guests.flatMap((g, i) => Array.from({ length: i < 8 ? 8 : i < 25 ? 3 : 1 }, () => g))

  // ---- reservations ----------------------------------------------------------
  const reservations: Prisma.reservationsCreateManyInput[] = []
  const reservationRooms: Prisma.reservation_roomsCreateManyInput[] = []
  const reservationGuests: Prisma.reservation_guestsCreateManyInput[] = []
  const companyInfo: Prisma.reservation_company_infoCreateManyInput[] = []
  const invoices: Prisma.invoicesCreateManyInput[] = []
  const payments: Prisma.paymentsCreateManyInput[] = []
  let invoiceSeq = 0
  let paymentSeq = 0

  const plans: Array<{ checkIn: string; nights: number; forced?: 'arrival_today' | 'departure_today' | 'in_house' }> = []
  for (let i = 0; i < 6; i++) plans.push({ checkIn: today, nights: int(1, 4), forced: 'arrival_today' })
  for (let i = 0; i < 5; i++) {
    const nights = int(2, 5)
    plans.push({ checkIn: addDays(today, -nights), nights, forced: 'departure_today' })
  }
  for (let i = 0; i < 8; i++) {
    const before = int(1, 3)
    plans.push({ checkIn: addDays(today, -before), nights: before + int(1, 4), forced: 'in_house' })
  }
  while (plans.length < 300) {
    const when = weighted([['past', 72], ['future', 28]] as const)
    const offset = when === 'past' ? -int(5, 365) : int(1, 60)
    plans.push({ checkIn: addDays(today, offset), nights: weighted([[1, 25], [2, 25], [3, 20], [4, 12], [5, 8], [7, 6], [10, 4]] as const) })
  }

  for (const plan of plans) {
    const checkIn = plan.checkIn
    const checkOut = addDays(checkIn, plan.nights)
    const bookingType = plan.forced ? 'individual' : weighted([['individual', 68], ['company', 20], ['group', 6], ['travel_agent', 6]] as const)
    const company = bookingType === 'company' ? pick(companies) : null
    const roomCount = bookingType === 'company' ? int(1, 4) : bookingType === 'group' ? int(2, 3) : 1
    const currency = company ? 'EGP' : weighted([['EGP', 78], ['USD', 16], ['EUR', 6]] as const)
    const source = company
      ? 'company'
      : bookingType === 'travel_agent'
        ? 'travel_agent'
        : weighted([['walk_in', 15], ['phone', 22], ['website', 18], ['whatsapp', 20], ['ota', 18], ['email', 7]] as const)

    let status: 'held' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show'
    if (plan.forced === 'arrival_today') status = 'confirmed'
    else if (plan.forced === 'departure_today' || plan.forced === 'in_house') status = 'checked_in'
    else if (checkOut <= today) status = weighted([['checked_out', 83], ['cancelled', 12], ['no_show', 5]] as const)
    else status = weighted([['confirmed', 80], ['held', 8], ['cancelled', 12]] as const)

    // Allocate rooms of fitting types that are free for the whole stay.
    const chosen: RoomRow[] = []
    for (let r = 0; r < roomCount; r++) {
      const wantedType = weighted([[DOUBLE, 45], [SINGLE, 20], [TRIPLE, 22], [SUITE, 13]] as const)
      const candidates = [...rooms.filter((room) => room.room_type_id === wantedType), ...rooms]
      const room = candidates.find((c) => !chosen.includes(c) && calendar.isFree(c.id, checkIn, checkOut))
      if (room) chosen.push(room)
    }
    if (!chosen.length) continue
    const blocks = status !== 'cancelled' && status !== 'no_show'
    if (blocks) for (const room of chosen) calendar.book(room.id, checkIn, checkOut)

    const reservationId = randomUUID()
    const guest = pick(guestPool)
    const adultsPerRoom = chosen.map((room) => Math.max(1, Math.min(CAPACITY[room.room_type_id], int(1, 3))))
    const roomLines = chosen.map((room) => {
      const rate = NIGHTLY_RATE[currency][room.room_type_id]
      return { room, rate, total: money(rate * plan.nights) }
    })
    const subtotal = money(roomLines.reduce((sum, line) => sum + line.total, 0))
    const discount = rand() < 0.1 ? money(subtotal * 0.1) : 0
    const service = money((subtotal - discount) * 0.1)
    const tax = money((subtotal - discount) * 0.14)
    const total = money(subtotal - discount + service + tax)
    const createdAt = new Date(day(addDays(checkIn, -int(0, 30))).getTime() + int(8, 20) * 3_600_000)

    const roomStatus = { held: 'held', confirmed: 'reserved', checked_in: 'occupied', checked_out: 'checked_out', cancelled: 'cancelled', no_show: 'released' } as const
    roomLines.forEach((line, index) => {
      const reservationRoomId = randomUUID()
      reservationRooms.push({
        id: reservationRoomId,
        reservation_id: reservationId,
        room_id: line.room.id,
        room_type_id: line.room.room_type_id,
        check_in_date: day(checkIn),
        check_out_date: day(checkOut),
        status: roomStatus[status],
        adults: adultsPerRoom[index],
        rate_per_night: line.rate,
        nights: plan.nights,
        subtotal_amount: line.total,
        total_amount: line.total,
        assigned_guest_id: index === 0 ? guest.id : null,
      })
      if (index === 0) {
        reservationGuests.push({
          reservation_id: reservationId,
          guest_id: guest.id,
          contact_id: contactByGuest.get(guest.id!),
          role: company ? 'company_guest' : 'primary_guest',
          full_name: `${guest.first_name} ${guest.last_name}`,
          phone: guest.phone,
          nationality: guest.country,
          reservation_room_id: reservationRoomId,
          assigned_room_id: line.room.id,
          is_primary: true,
          is_vip: guest.status === 'vip',
        })
      }
    })

    // ---- billing --------------------------------------------------------
    let paid = 0
    let balance = total
    const invoiceFor = (issueDate: string, dueDays: number, invoiceStatusHint: 'final' | 'deposit' | 'in_house') => {
      const invoiceId = randomUUID()
      invoiceSeq++
      const pays: Array<{ date: string; amount: number }> = []
      if (invoiceStatusHint === 'deposit') {
        pays.push({ date: issueDate, amount: money(total * pick([0.2, 0.25, 0.3, 0.5])) })
      } else if (invoiceStatusHint === 'in_house') {
        pays.push({ date: checkIn, amount: money(total * pick([0.3, 0.5, 1])) })
      } else {
        const pattern = company ? weighted([['full', 45], ['partial', 25], ['none', 30]] as const) : weighted([['full', 72], ['partial', 16], ['none', 12]] as const)
        // Deposit paid before arrival.
        if (rand() < 0.25 && !company) pays.push({ date: addDays(checkIn, -int(3, 20)), amount: money(total * 0.25) })
        const already = pays.reduce((s, p) => s + p.amount, 0)
        if (pattern === 'full') pays.push({ date: company ? addDays(issueDate, int(5, 25)) : issueDate, amount: money(total - already) })
        else if (pattern === 'partial') pays.push({ date: issueDate, amount: money((total - already) * pick([0.3, 0.5, 0.6])) })
      }
      const validPays = pays.filter((p) => p.amount > 0 && p.date <= today)
      const paidAmount = money(validPays.reduce((s, p) => s + p.amount, 0))
      // A handful of refunds (stored as negative payments).
      let refunded = 0
      if (invoiceStatusHint === 'final' && paidAmount >= total && invoiceSeq % 37 === 0) {
        refunded = money(total * 0.15)
        validPays.push({ date: addDays(issueDate, 2) <= today ? addDays(issueDate, 2) : issueDate, amount: -refunded })
      }
      const netPaid = money(paidAmount - refunded)
      const remaining = money(Math.max(0, total - paidAmount))
      const dueDate = addDays(issueDate, dueDays)
      const invoiceStatus =
        refunded > 0 ? 'partially_refunded' : remaining <= 0 ? 'paid' : paidAmount > 0 ? 'partially_paid' : dueDate < today ? 'overdue' : 'issued'
      invoices.push({
        id: invoiceId,
        contact_id: company ? company.id : contactByGuest.get(guest.id!)!,
        invoice_number: `DEMO-INV-${String(invoiceSeq).padStart(4, '0')}`,
        amount: total,
        subtotal,
        discount,
        service_charge: service,
        tax_amount: tax,
        paid_amount: paidAmount,
        refunded_amount: refunded,
        remaining_balance: remaining,
        status: invoiceStatus,
        issue_date: day(issueDate),
        due_date: day(dueDate),
        issued_at: day(issueDate),
        issued_by: admin.id,
        created_by: admin.id,
        paid_at: remaining <= 0 && validPays.length ? day(validPays[validPays.length - 1].date) : null,
        currency,
        reservation_id: reservationId,
        guest_name: `${guest.first_name} ${guest.last_name}`,
        company_name: company?.name ?? null,
        room_number: chosen[0].number,
        stay_check_in: day(checkIn),
        stay_check_out: day(checkOut),
      })
      for (const p of validPays) {
        paymentSeq++
        payments.push({
          invoice_id: invoiceId,
          amount: p.amount,
          currency,
          method: p.amount < 0 ? 'cash' : company ? weighted([['bank_transfer', 70], ['company_credit', 20], ['instapay', 10]] as const) : weighted([['cash', 35], ['visa', 25], ['instapay', 20], ['vodafone_cash', 12], ['bank_transfer', 8]] as const),
          transaction_date: day(p.date),
          payment_number: `DEMO-PAY-${String(paymentSeq).padStart(5, '0')}`,
          description: p.amount < 0 ? 'Partial refund' : null,
          created_by: admin.id,
          received_by: admin.id,
        })
      }
      paid = netPaid
      balance = remaining
    }

    if (status === 'checked_out') invoiceFor(checkOut > today ? today : checkOut, company ? 30 : 0, 'final')
    else if (status === 'checked_in') invoiceFor(checkIn, company ? 30 : 7, 'in_house')
    else if ((status === 'confirmed' || status === 'held') && rand() < 0.4) {
      const issue = iso(createdAt) <= today ? iso(createdAt) : today
      invoiceFor(issue, Math.max(0, Math.round((day(checkIn).getTime() - day(issue).getTime()) / DAY)), 'deposit')
    }

    const live = status !== 'cancelled' && status !== 'no_show'
    reservations.push({
      id: reservationId,
      booking_type: bookingType,
      status,
      source,
      check_in_date: day(checkIn),
      check_out_date: day(checkOut),
      nights: plan.nights,
      adults: adultsPerRoom.reduce((s, a) => s + a, 0),
      children: rand() < 0.15 ? int(1, 2) : 0,
      room_count: chosen.length,
      primary_guest_id: guest.id,
      company_id: company?.id ?? null,
      booker_name: company ? company.responsible_person : `${guest.first_name} ${guest.last_name}`,
      booker_phone: company ? company.phone : guest.phone,
      billing_party: company ? 'company' : 'guest',
      billing_type: company ? 'company_all_charges' : 'guest_pays',
      currency,
      subtotal_amount: subtotal,
      discount_amount: discount,
      service_amount: service,
      tax_amount: tax,
      total_amount: total,
      paid_amount: live ? Math.max(0, paid) : 0,
      balance_amount: live ? balance : 0,
      created_by: admin.id,
      created_at: createdAt,
      cancelled_at: status === 'cancelled' ? new Date(day(addDays(checkIn, -int(1, 10))).getTime()) : null,
      checked_in_at: status === 'checked_in' || status === 'checked_out' ? new Date(day(checkIn).getTime() + 14 * 3_600_000) : null,
      checked_out_at: status === 'checked_out' ? new Date(day(checkOut).getTime() + 10 * 3_600_000) : null,
    })
    if (company) {
      companyInfo.push({
        reservation_id: reservationId,
        company_id: company.id,
        company_name: company.name,
        contact_person_name: company.responsible_person,
        contact_person_phone: company.phone,
        payment_terms: 'net_30',
        company_pays: 'all_charges',
      })
    }
  }

  // ---- expenses --------------------------------------------------------------
  const expenses: Prisma.expensesCreateManyInput[] = []
  const [salaries, utilities, maintenance, supplies, food, marketing, taxes] = EXPENSE_CATEGORIES.map((c) => c.id)
  const expense = (categoryId: string, date: string, amount: number, description: string, extra: Partial<Prisma.expensesCreateManyInput> = {}) => {
    if (date > today) return
    const status = (extra.status as string | undefined) ?? weighted([['paid', 82], ['approved', 10], ['draft', 8]] as const)
    expenses.push({
      category_id: categoryId,
      date: day(date),
      amount: money(amount),
      total_amount: money(amount),
      currency: 'EGP',
      description,
      created_by: admin.id,
      approved_by: status === 'draft' ? null : admin.id,
      approved_at: status === 'draft' ? null : day(date),
      payment_method: 'cash',
      ...extra,
      status,
    })
  }
  for (let m = 11; m >= 0; m--) {
    const monthStart = `${addDays(today, -30 * m).slice(0, 7)}-01`
    expense(salaries, addDays(monthStart, 27), int(180_000, 200_000), 'رواتب الموظفين', { status: 'paid', payment_method: 'bank_transfer', vendor: 'Payroll' })
    expense(utilities, addDays(monthStart, 10), int(14_000, 26_000), 'فاتورة الكهرباء', { vendor: 'الشركة القابضة لكهرباء مصر' })
    expense(utilities, addDays(monthStart, 12), int(3_000, 6_000), 'فاتورة المياه', { vendor: 'شركة مياه الشرب' })
    expense(utilities, addDays(monthStart, 5), 2_500, 'Internet subscription', { vendor: 'WE Telecom', payment_method: 'bank_transfer' })
    for (let k = 0; k < int(2, 4); k++) expense(supplies, addDays(monthStart, int(1, 27)), int(2_000, 9_000), pick(['مناشف ومفارش', 'مواد تنظيف', 'Toiletries restock']), { vendor: pick(['Metro Supplies', 'مخازن النور']) })
    for (let k = 0; k < int(1, 3); k++) expense(food, addDays(monthStart, int(1, 27)), int(4_000, 15_000), pick(['Breakfast supplies', 'خضار وفاكهة', 'مشروبات']), { vendor: pick(['Gourmet Egypt', 'سوق العبور']) })
    if (rand() < 0.6) expense(maintenance, addDays(monthStart, int(1, 27)), int(1_500, 35_000), pick(['صيانة تكييف', 'Plumbing repair', 'Elevator service', 'دهانات الغرف']), { vendor: pick(['Cool Air Co.', 'فني سباكة', 'Schindler Egypt']) })
    if (rand() < 0.5) expense(marketing, addDays(monthStart, int(1, 27)), int(100, 600), 'Online ads', { currency: 'USD', vendor: pick(['Meta Ads', 'Google Ads']), payment_method: 'card' })
    if (m % 3 === 0) expense(taxes, addDays(monthStart, 20), int(20_000, 40_000), 'ضريبة القيمة المضافة', { status: 'paid', vendor: 'مصلحة الضرائب', payment_method: 'bank_transfer' })
  }

  // ---- live room state -------------------------------------------------------
  const inHouseRooms = new Set(
    reservationRooms.filter((rr) => rr.status === 'occupied').map((rr) => rr.room_id),
  )

  await prisma.$transaction(
    async (tx) => {
      await tx.contacts.createMany({ data: [...companies, ...guestContacts] })
      await tx.guests.createMany({ data: guests })
      await tx.reservations.createMany({ data: reservations })
      await tx.reservation_rooms.createMany({ data: reservationRooms })
      await tx.reservation_guests.createMany({ data: reservationGuests })
      await tx.reservation_company_info.createMany({ data: companyInfo })
      await tx.invoices.createMany({ data: invoices })
      await tx.payments.createMany({ data: payments })
      await tx.expenses.createMany({ data: expenses })
      for (const roomId of inHouseRooms) await tx.rooms.update({ where: { id: roomId }, data: { occupancy_status: 'occupied' } })
      const vacant = rooms.filter((r) => !inHouseRooms.has(r.id))
      for (const room of vacant.slice(0, 3)) await tx.rooms.update({ where: { id: room.id }, data: { housekeeping_status: 'dirty' } })
      if (vacant[3]) await tx.rooms.update({ where: { id: vacant[3].id }, data: { operational_status: 'maintenance' } })
      if (vacant[4]) await tx.rooms.update({ where: { id: vacant[4].id }, data: { operational_status: 'out_of_order' } })
    },
    { timeout: 180_000, maxWait: 20_000 },
  )

  const count = (s: string) => reservations.filter((r) => r.status === s).length
  console.log(
    `Demo data seeded (today = ${today}):\n` +
      `  rooms ${rooms.length}, companies ${companies.length}, guests ${guests.length}\n` +
      `  reservations ${reservations.length} (checked_out ${count('checked_out')}, in-house ${count('checked_in')}, confirmed ${count('confirmed')}, held ${count('held')}, cancelled ${count('cancelled')}, no_show ${count('no_show')})\n` +
      `  invoices ${invoices.length}, payments ${payments.length}, expenses ${expenses.length}`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

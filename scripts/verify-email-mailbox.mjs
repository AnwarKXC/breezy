import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Exercise real mailbox operations with a fake IMAP/SMTP account. No network calls.
const require = createRequire(import.meta.url)
let boxes = []
let found = [7, 8]
const calls = []
const client = {
  capabilities: new Set(),
  close() {},
  connect: async () => {}, logout: async () => {}, list: async () => boxes,
  getMailboxLock: async (path) => { calls.push(['lock', path]); return { release() {} } },
  search: async (query) => { calls.push(['search', query]); return found },
  fetch: async function* (uids) { for (const uid of uids) yield { uid, envelope: { subject: 'Mail', date: new Date('2026-10-01'), messageId: `<${uid}@example.com>` }, flags: new Set() } },
  messageMove: async (...args) => { calls.push(['move', ...args]); return true },
  messageDelete: async (...args) => { calls.push(['delete', ...args]); return true },
  messageFlagsAdd: async (...args) => { calls.push(['add', ...args]); return true },
  messageFlagsRemove: async (...args) => { calls.push(['remove', ...args]); return true },
  mailboxCreate: async (path) => { calls.push(['create', path]) },
  fetchOne: async () => ({ uid: 7 }),
  append: async (...args) => { calls.push(['append', ...args]); return { uid: 9 } },
  status: async () => ({ unseen: 3 }),
}
let smtpFails = false
let smtpGate
let onSmtpStart
let smtpSends = 0
const draftLocks = {}
const heldKeys = new Set()
const acquiredKeys = []
const lockCode = ts.transpileModule(readFileSync(new URL('../src/services/email/draftLock.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
runInNewContext(lockCode, {
  exports: draftLocks,
  require: (id) => id === 'server-only' ? {} : { prisma: {
    $transaction: async (run, options) => {
      assert.equal(options.timeout, 120_000)
      const acquired = []
      try {
        return await run({ $queryRaw: async (_template, key) => {
          if (heldKeys.has(key)) return [{ locked: false }]
          heldKeys.add(key); acquired.push(key); acquiredKeys.push(key)
          return [{ locked: true }]
        } })
      } finally { for (const key of acquired) heldKeys.delete(key) }
    },
  } },
})
class Composer { compile() { return { build: async () => Buffer.from('draft') } } }
const exports = {}
const compiled = ts.transpileModule(readFileSync(new URL('../src/services/email/mailbox.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
runInNewContext(compiled, {
  exports, Buffer, console, setTimeout, clearTimeout,
  require: (id) => {
    if (id === 'server-only') return {}
    if (id === './account') return {
      getEmailAccount: async () => ({ email: 'hotel@example.com', smtpHost: 'smtp.gmail.com' }),
      createImapClient: () => client,
      createSmtpTransport: () => ({ sendMail: async () => { smtpSends++; if (smtpFails) throw new Error('SMTP failed'); onSmtpStart?.(); if (smtpGate) await smtpGate }, close() {} }),
    }
    if (id === 'mailparser') return { simpleParser: async () => ({}) }
    if (id === 'nodemailer/lib/mail-composer') return Composer
    if (id === './draftLock') return draftLocks
    if (id === './smtp') return { sendSmtpMessage: async () => { smtpSends++; if (smtpFails) throw new Error('SMTP failed'); onSmtpStart?.(); if (smtpGate) await smtpGate } }
    return require(id)
  },
})

await assert.rejects(exports.deleteMessage('inbox', 7), /email\/folder_not_found/)
assert.equal(calls.some(([name]) => name === 'delete'), false, 'missing Trash never permanently deletes')
await assert.rejects(exports.updateMessages('inbox', [7], 'deleteForever'), /delete_requires_trash/)
boxes = [{ name: 'Deleted Items', path: 'Deleted Items', specialUse: '\\Trash' }]
await exports.updateMessages('inbox', [7, 8], 'trash')
assert.equal(calls.at(-1)[0], 'move')
assert.equal(calls.at(-1)[1], '7,8')
assert.equal(calls.at(-1)[2], 'Deleted Items')
await exports.updateMessages('trash', [7], 'restore')
assert.equal(calls.at(-1)[2], 'INBOX')
await exports.updateMessages('inbox', [7], 'pin')
assert.equal(calls.at(-1)[0], 'add')
assert.equal(calls.at(-1)[2][0], '\\Flagged')
await exports.updateMessages('inbox', [7], 'unread')
assert.equal(calls.at(-1)[0], 'remove')
assert.equal(calls.at(-1)[2][0], '\\Seen')
const beforeMissing = calls.length
found = [7]
await assert.rejects(exports.updateMessages('inbox', [7, 8], 'trash'), /message_not_found/)
assert.equal(calls.slice(beforeMissing).some(([name]) => name === 'move'), false)
await exports.updateMessages('inbox', [7], 'archive')
assert.ok(calls.some(([name, path]) => name === 'create' && path === 'Archive'))
assert.equal(calls.at(-1)[2], 'Archive')
await exports.updateMessages('trash', [7], 'deleteForever')
assert.equal(calls.at(-1)[0], 'delete')
const mail = { to: [], cc: [], subject: '', text: 'work in progress', attachments: [], draftUid: 7 }
assert.equal((await exports.saveDraft(mail)).uid, 9)
assert.ok(calls.findIndex(([name]) => name === 'append') < calls.findLastIndex(([name]) => name === 'delete'), 'save new draft before removing old')
smtpFails = true
boxes.push({ name: 'Drafts', path: 'Drafts', specialUse: '\\Drafts' })
const beforeSend = calls.length
await assert.rejects(exports.sendMessage({ ...mail, to: ['guest@example.com'] }), /SMTP failed/)
assert.equal(calls.slice(beforeSend).some(([name]) => name === 'delete'), false, 'failed SMTP send must retain draft')
client.fetchOne = async () => false
await assert.rejects(exports.sendMessage({ ...mail, to: ['guest@example.com'] }), /message_not_found/)
assert.equal(await exports.unreadCount(), 3)
const originalDelete = client.messageDelete
client.fetchOne = async () => ({ uid: 7 })
client.messageDelete = async () => false
const retainedDraft = await exports.saveDraft(mail)
assert.equal(retainedDraft.uid, 9, 'successful append always returns new draft UID')
assert.equal(retainedDraft.replaced, false, 'old draft cleanup failure is a warning')
client.messageDelete = originalDelete
client.capabilities.add('X-GM-EXT-1')
boxes = [{ name: 'All Mail', path: '[Gmail]/All Mail', specialUse: '\\All' }]
await exports.listMessages('archive', { page: 1, pageSize: 25, search: '' })
assert.ok(calls.some(([name, query]) => name === 'search' && query.gmraw === '-in:inbox -in:sent -in:trash -in:drafts'), 'Gmail archive excludes Inbox/Sent')
boxes.push({ name: 'Sent', path: '[Gmail]/Sent Mail', specialUse: '\\Sent' })
const originalSearch = client.search
client.search = async (query) => {
  calls.push(['search', query])
  return query.gmraw === '-in:inbox' ? [8] : query.gmraw ? [9] : [7]
}
const pinnedPage = await exports.listMessages('pinned', { page: 1, pageSize: 2, search: '' })
assert.equal(pinnedPage.total, 3)
assert.equal(pinnedPage.items.length, 2)
const pinnedLastPage = await exports.listMessages('pinned', { page: 2, pageSize: 2, search: '' })
assert.equal(pinnedLastPage.total, 3)
assert.equal(pinnedLastPage.items.length, 1)
assert.ok(calls.some(([name, query]) => name === 'search' && query.flagged === true && query.gmraw === '-in:inbox'), 'Gmail pinned Sent excludes Inbox labels')
client.search = originalSearch
const contracts = {}
const contractCode = ts.transpileModule(readFileSync(new URL('../src/services/email/contracts.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
runInNewContext(contractCode, { exports: contracts, require: (id) => id === './mailbox' ? exports : require(id) })
assert.equal(contracts.DraftSchema.safeParse({ to: [], cc: [], subject: '', text: '' }).success, true)
assert.equal(contracts.SendSchema.safeParse({ to: [], cc: [], subject: '', text: '' }).success, false)
assert.equal(contracts.SendSchema.safeParse({ to: ['guest@example.com'], subject: 'test\r\nBcc: attacker@example.com', text: '' }).success, false)
assert.equal(contracts.FolderSchema.safeParse('invalid-folder').success, false)
assert.equal(contracts.FolderSchema.parse(null), 'inbox')
assert.equal(contracts.BulkSchema.safeParse({ folder: 'pinned', uids: [7], action: 'trash' }).success, false)
assert.equal(contracts.BulkSchema.safeParse({ folder: 'inbox', uids: Array.from({ length: 101 }, (_, i) => i + 1), action: 'read' }).success, false)
await draftLocks.withDraftLocks('hotel@example.com', [9, 7, 9], async () => {})
assert.equal(acquiredKeys.at(-2), 'email:draft:hotel@example.com:7')
assert.equal(acquiredKeys.at(-1), 'email:draft:hotel@example.com:9')
boxes = [{ name: 'Drafts', path: 'Drafts', specialUse: '\\Drafts' }, { name: 'Trash', path: 'Trash', specialUse: '\\Trash' }]
client.fetchOne = async () => ({ uid: 7 })
smtpFails = false
let finishSend
smtpGate = new Promise((resolve) => { finishSend = resolve })
const started = new Promise((resolve) => { onSmtpStart = resolve })
const firstSend = exports.sendMessage({ ...mail, to: ['guest@example.com'] })
await started
await assert.rejects(exports.sendMessage({ ...mail, to: ['guest@example.com'] }), /draft_busy/)
await assert.rejects(exports.saveDraft(mail), /draft_busy/)
await assert.rejects(exports.updateMessages('drafts', [7], 'trash'), /draft_busy/)
client.messageDelete = async (...args) => { client.fetchOne = async () => false; return originalDelete(...args) }
finishSend()
assert.equal((await firstSend).draftRemoved, true)
const deliveredCount = smtpSends
await assert.rejects(exports.sendMessage({ ...mail, to: ['guest@example.com'] }), /message_not_found/)
assert.equal(smtpSends, deliveredCount, 'stale draft request cannot send again')
assert.equal(heldKeys.size, 0, 'transaction locks released after errors and success')
let sentMarker = false
client.fetchOne = async () => ({ uid: 7, flags: new Set(sentMarker ? ['\\Answered'] : []) })
client.messageFlagsAdd = async (_uid, flags) => { sentMarker = flags.includes('\\Answered'); return true }
client.messageDelete = async () => false
assert.equal((await exports.sendMessage({ ...mail, to: ['guest@example.com'] })).draftRemoved, false)
const sentBeforeRetry = smtpSends
await assert.rejects(exports.sendMessage({ ...mail, to: ['guest@example.com'] }), /draft_already_sent/)
await assert.rejects(exports.saveDraft(mail), /draft_already_sent/)
assert.equal(smtpSends, sentBeforeRetry, 'retained sent draft cannot be sent or edited into a resend')
console.log('Email mailbox safety checks passed (missing Trash, bulk actions, archive, draft replacement, SMTP failure).')

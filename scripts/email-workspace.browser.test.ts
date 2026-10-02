/**
 * Real EmailPage/Mailbox/MailComposer, real React/cache/CSS, isolated Chromium.
 * Only the provider/auth shell and mail HTTP responses are fixtures: this never
 * connects to IMAP/SMTP or reads credentials. Run with:
 * node --import tsx --test scripts/email-workspace.browser.test.ts
 */
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { chromium, expect, type Browser, type Page } from '@playwright/test'
import type { MailDetail, MailAttachment, MailFolder } from '../src/modules/settings/components/email/emailApi'

const root = process.cwd()
const fixtureRequire = createRequire(path.join(root, 'package.json'))
const esbuild = createRequire(fixtureRequire.resolve('tsx/package.json'))('esbuild')
const postcss = createRequire(fixtureRequire.resolve('@tailwindcss/postcss'))('postcss')
const tailwind = fixtureRequire('@tailwindcss/postcss')
const dictionaries = {
  en: JSON.parse(readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8')),
  ar: JSON.parse(readFileSync(path.join(root, 'src/i18n/locales/ar.json'), 'utf8')),
}
const t = (key: string, locale: 'en' | 'ar' = 'en'): string =>
  key.split('.').reduce((value, part) => value?.[part], dictionaries[locale]) ?? key
const api = '/api/settings/email/messages'
let server: Server
let browser: Browser
let origin: string
let bundle: string
let css: string

interface FixtureMessage extends MailDetail { folder: MailFolder }
interface Mutation { folder: MailFolder; uids: number[]; action: string }
interface ComposePayload { to: string[]; cc: string[]; subject: string; text: string; attachments: MailAttachment[]; draftUid?: number }
let messages: FixtureMessage[] = []
let mutations: Mutation[] = []
let saved: ComposePayload[] = []
let sent: ComposePayload[] = []
let detailReads: number[] = []
let saveReplaced = true
let sendDraftRemoved = true
let sendFailure = false

function fixture(uid: number, subject: string): FixtureMessage {
  return { uid, folder: 'inbox', subject, from: [{ name: 'Guest', address: 'guest@example.test' }], to: [{ name: 'Hotel', address: 'hotel@example.test' }],
    date: '2026-10-02T09:00:00Z', seen: false, flagged: false, hasAttachments: false,
    cc: [], replyTo: [], messageId: `<message-${uid}@example.test>`, references: [], html: null, text: 'Please confirm my reservation.', attachments: [] }
}

function reset() {
  messages = [fixture(1, 'Reservation question'), fixture(2, 'Arrival update')]
  mutations = []; saved = []; sent = []; detailReads = []
  saveReplaced = true; sendDraftRemoved = true; sendFailure = false
}

before(async () => {
  const componentPath = path.join(root, 'src/modules/email/components/EmailPage.tsx').replaceAll('\\', '/')
  const result = await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{EmailPage}from ${JSON.stringify(componentPath)};
      const query=new URLSearchParams(location.search);document.documentElement.dir=query.get('locale')==='ar'?'rtl':'ltr';
      createRoot(document.getElementById('root')).render(<EmailPage canEdit={query.get('viewer')!=='1'} canConfigure={query.get('viewer')!=='1'}/>);`,
      resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'fixture-providers', setup(build: {
      onResolve(options: { filter: RegExp }, callback: (args: { path: string }) => { path: string; namespace: string }): void
      onLoad(options: { filter: RegExp; namespace: string }, callback: (args: { path: string }) => { contents: string; loader: string; resolveDir: string }): void
    }) {
      build.onResolve({ filter: /^(next\/link|@\/i18n\/hooks\/useTranslation|@\/shared\/toast\/toastEvents)$/ }, (args) => ({ path: args.path, namespace: 'fixture' }))
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ loader: 'tsx', resolveDir: root, contents:
        args.path === 'next/link' ? `export default function Link(props){return <a {...props}/>}` :
          args.path.includes('toastEvents') ? `const record=(type,message)=>{const node=document.createElement('p');node.dataset.toastType=type;node.textContent=message;document.getElementById('fixture-toasts').append(node)};export const toast={success(message){record('success',message)},warning(message){record('warning',message)},error(message){record('error',message)}}` :
            `const dictionaries=${JSON.stringify(dictionaries)};export function useTranslation(){const locale=new URLSearchParams(location.search).get('locale')==='ar'?'ar':'en';return{locale,dir:locale==='ar'?'rtl':'ltr',t:key=>key.split('.').reduce((value,part)=>value?.[part],dictionaries[locale])??key}}`,
      }))
    } }],
  })
  bundle = result.outputFiles[0].text
  css = (await postcss([tailwind({ base: root })]).process(await readFile(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') })).css
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const json = (data: unknown) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ data })) }
    if (url.pathname === '/bundle.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(bundle); return }
    if (url.pathname === '/style.css') { response.setHeader('Content-Type', 'text/css'); response.end(css); return }
    if (url.pathname === '/api/email/account') { json({ email: 'hotel@example.test', displayName: 'Shared hotel inbox' }); return }
    if (url.pathname.startsWith(api)) {
      const chunks = []; for await (const chunk of request) chunks.push(chunk)
      const payload = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null
      const folder = (url.searchParams.get('folder') ?? 'inbox') as MailFolder
      const uid = Number(url.pathname.slice(api.length + 1).split('/')[0])
      if (request.method === 'PATCH') {
        const mutation = payload as Mutation; mutations.push(mutation)
        for (const message of messages.filter((m) => mutation.uids.includes(m.uid) && m.folder === mutation.folder)) {
          if (mutation.action === 'read' || mutation.action === 'unread') message.seen = mutation.action === 'read'
          if (mutation.action === 'pin' || mutation.action === 'unpin') message.flagged = mutation.action === 'pin'
          if (mutation.action === 'archive') message.folder = 'archive'
          if (mutation.action === 'trash') message.folder = 'trash'
          if (mutation.action === 'restore') message.folder = 'inbox'
        }
        if (mutation.action === 'deleteForever') messages = messages.filter((m) => !(m.folder === mutation.folder && mutation.uids.includes(m.uid)))
        json({ updated: mutation.uids.length }); return
      }
      if (request.method === 'POST') {
        const compose = payload as ComposePayload
        if (!url.pathname.endsWith('/drafts') && sendFailure) {
          response.statusCode = 502; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: 'email/smtp_failed' })); return
        }
        if (url.pathname.endsWith('/drafts')) {
          saved.push(compose)
          const draft = { ...fixture(30, compose.subject), folder: 'drafts' as const, to: compose.to.map((address) => ({ address, name: '' })), cc: compose.cc.map((address) => ({ address, name: '' })), text: compose.text,
            hasAttachments: compose.attachments.length > 0, attachments: compose.attachments.map((attachment, index) => ({ ...attachment, index, size: Buffer.from(attachment.content, 'base64').length })) }
          messages = [...messages.filter((m) => m.uid !== 30), draft]
        } else { sent.push(compose); if (sendDraftRemoved) messages = messages.filter((m) => m.uid !== compose.draftUid) }
        json(url.pathname.endsWith('/drafts') ? { uid: 30, replaced: saveReplaced } : { uid: 30, draftRemoved: sendDraftRemoved }); return
      }
      if (uid) {
        detailReads.push(uid)
        const message = messages.find((m) => m.uid === uid && m.folder === folder)
        if (!message) { response.statusCode = 404; json(null); return }
        message.seen = true; json(message); return
      }
      const items = messages.filter((m) => folder === 'pinned' ? m.flagged && m.folder !== 'trash' : m.folder === folder)
      json({ items, total: items.length, page: 1, pageSize: 25 }); return
    }
    if (url.pathname === '/favicon.ico') { response.statusCode = 204; response.end(); return }
    response.setHeader('Content-Type', 'text/html')
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'")
    response.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-page-bg"><main id="root" class="mx-auto max-w-7xl p-4 sm:p-6"></main><aside id="fixture-toasts" hidden></aside><script src="/bundle.js"></script></body></html>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address(); assert(address && typeof address !== 'string')
  origin = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
})

async function visit(locale: 'en' | 'ar', mobile = false, viewer = false) {
  reset()
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()) })
  await page.goto(`${origin}/?locale=${locale}&viewer=${viewer ? '1' : '0'}`)
  await expect(page.getByRole('heading', { name: t('email.title', locale), exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Reservation question/ })).toBeVisible()
  return { page, errors }
}

async function noOverflow(page: Page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'page must fit viewport')
}

for (const locale of ['en', 'ar'] as const) {
  test(`Email workspace ${locale}: ${locale === 'ar' ? 'mobile RTL' : 'desktop'} bulk read, pin, archive and restore`, async () => {
    const { page, errors } = await visit(locale, locale === 'ar')
    try {
      await noOverflow(page)
      assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr')
      if (process.env.EMAIL_BROWSER_SCREENSHOT_DIR) {
        await mkdir(process.env.EMAIL_BROWSER_SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({ path: path.join(process.env.EMAIL_BROWSER_SCREENSHOT_DIR, `email-${locale}.png`), fullPage: true })
      }
      const selectAll = () => page.getByRole('checkbox', { name: t('settings.email.inbox.selectAll', locale), exact: true })
      await selectAll().check()
      await page.getByRole('button', { name: t('settings.email.actions.read', locale), exact: true }).click()
      await expect.poll(() => mutations.length).toBe(1)
      assert.deepEqual(mutations[0], { folder: 'inbox', uids: [1, 2], action: 'read' })
      await expect(selectAll()).not.toBeChecked()
      await selectAll().check()
      await page.getByRole('button', { name: t('settings.email.actions.pin', locale), exact: true }).click()
      await expect.poll(() => mutations.length).toBe(2)
      await page.getByRole('tab', { name: t('settings.email.folders.pinned', locale), exact: true }).click()
      await expect(page.getByRole('button', { name: /Arrival update/ })).toBeVisible()
      await selectAll().check()
      await page.getByRole('button', { name: t('settings.email.actions.archive', locale), exact: true }).click()
      await expect.poll(() => mutations.length).toBe(3)
      assert.deepEqual(mutations[2], { folder: 'inbox', uids: [1, 2], action: 'archive' }, 'pinned rows retain real source folder')
      await page.getByRole('tab', { name: t('settings.email.folders.archive', locale), exact: true }).click()
      await expect(page.getByRole('button', { name: /Reservation question/ })).toBeVisible()
      await selectAll().check()
      await page.getByRole('button', { name: t('settings.email.actions.restore', locale), exact: true }).click()
      await expect.poll(() => mutations.length).toBe(4)
      await expect(page.getByRole('button', { name: /Reservation question/ })).toHaveCount(0)
      await noOverflow(page)
      assert.deepEqual(errors, [])
    } finally { await page.close() }
  })
}

test('Pinned messages with the same UID in different folders keep distinct rows and bulk mutation origins', async () => {
  const { page, errors } = await visit('en')
  try {
    messages[0].flagged = true
    messages.push({ ...fixture(1, 'Archived priority'), folder: 'archive', flagged: true })
    await page.getByRole('tab', { name: t('settings.email.folders.pinned'), exact: true }).click()
    await expect(page.getByRole('button', { name: /Reservation question/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Archived priority/ })).toBeVisible()
    await page.getByRole('checkbox', { name: t('settings.email.inbox.selectAll'), exact: true }).check()
    await page.getByRole('button', { name: t('settings.email.actions.unpin'), exact: true }).click()
    await expect.poll(() => mutations.length).toBe(2)
    assert.deepEqual(mutations, [{ folder: 'inbox', uids: [1], action: 'unpin' }, { folder: 'archive', uids: [1], action: 'unpin' }])
    await expect(page.getByRole('button', { name: /Archived priority/ })).toHaveCount(0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('Pin keeps the reader open and reopening after unread fetches the message again', async () => {
  const { page, errors } = await visit('en')
  try {
    await page.getByRole('button', { name: /Reservation question/ }).click()
    await expect(page.getByRole('heading', { name: 'Reservation question', exact: true })).toBeVisible()
    await page.getByRole('button', { name: t('settings.email.actions.pin'), exact: true }).click()
    await expect(page.getByRole('button', { name: t('settings.email.actions.unpin'), exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reservation question', exact: true })).toBeVisible()
    await page.getByRole('button', { name: t('settings.email.actions.unread'), exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Reservation question', exact: true })).toHaveCount(0)
    await expect.poll(() => messages[0].seen).toBe(false)
    const priorReads = detailReads.length
    await page.getByRole('button', { name: /Reservation question/ }).click()
    await expect.poll(() => detailReads.length).toBe(priorReads + 1)
    assert.equal(messages[0].seen, true)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('Email composer saves and reopens a draft with its attachment, then sends its captured payload', async () => {
  const { page, errors } = await visit('en')
  try {
    await page.getByRole('button', { name: t('settings.email.compose.title'), exact: true }).click()
    await page.getByRole('textbox', { name: t('settings.email.compose.to'), exact: true }).fill('guest@example.test')
    await page.getByRole('textbox', { name: t('settings.email.compose.subject'), exact: true }).fill('Saved itinerary')
    await page.getByRole('textbox', { name: t('settings.email.compose.body'), exact: true }).fill('Your itinerary is attached.')
    await page.locator('input[type=file]').setInputFiles({ name: 'itinerary.txt', mimeType: 'text/plain', buffer: Buffer.from('Hotel itinerary') })
    await page.getByRole('button', { name: t('settings.email.compose.saveDraft'), exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    assert.equal(saved.length, 1)
    await page.getByRole('tab', { name: t('settings.email.folders.drafts'), exact: true }).click()
    await page.getByRole('button', { name: /Saved itinerary/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('textbox', { name: t('settings.email.compose.body'), exact: true })).toHaveValue('Your itinerary is attached.')
    await expect(page.getByText('itinerary.txt', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: t('settings.email.compose.send'), exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    assert.equal(sent.length, 1)
    assert.deepEqual(sent[0].attachments, saved[0].attachments)
    assert.equal(sent[0].draftUid, 30)
    assert.deepEqual(sent[0].to, ['guest@example.test'])
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('Email read-only permission hides configuration and mutation controls; HTML remains sandboxed', async () => {
  const { page, errors } = await visit('en', true, true)
  try {
    messages[0].html = '<p>Reservation confirmation</p>'
    await expect(page.getByRole('link', { name: t('email.configure'), exact: true })).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: t('settings.email.compose.title'), exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /Reservation question/ }).click()
    await expect(page.locator('iframe')).toBeVisible()
    const sandbox = await page.locator('iframe').getAttribute('sandbox')
    assert(sandbox && !sandbox.includes('allow-scripts') && !sandbox.includes('allow-same-origin'))
    await expect(page.frameLocator('iframe').getByText('Reservation confirmation')).toBeVisible()
    await expect(page.getByRole('button', { name: t('settings.email.actions.archive'), exact: true })).toHaveCount(0)
    await noOverflow(page)
    assert.deepEqual(mutations, [])
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

async function composeItinerary(page: Page) {
  await page.getByRole('button', { name: t('settings.email.compose.title'), exact: true }).click()
  await page.getByRole('textbox', { name: t('settings.email.compose.to'), exact: true }).fill('guest@example.test')
  await page.getByRole('textbox', { name: t('settings.email.compose.subject'), exact: true }).fill('Saved itinerary')
  await page.getByRole('textbox', { name: t('settings.email.compose.body'), exact: true }).fill('Your itinerary is attached.')
  await page.locator('input[type=file]').setInputFiles({ name: 'itinerary.txt', mimeType: 'text/plain', buffer: Buffer.from('Hotel itinerary') })
}

for (const operation of ['save', 'send'] as const) {
  test(`Draft ${operation} cleanup failure warns staff and closes the successfully saved/sent composer`, async () => {
    const { page, errors } = await visit('en')
    try {
      await composeItinerary(page)
      await page.getByRole('button', { name: t('settings.email.compose.saveDraft'), exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.getByRole('tab', { name: t('settings.email.folders.drafts'), exact: true }).click()
      await page.getByRole('button', { name: /Saved itinerary/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      if (operation === 'save') saveReplaced = false
      else sendDraftRemoved = false
      await page.getByRole('button', { name: t(`settings.email.compose.${operation === 'save' ? 'saveDraft' : 'send'}`), exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.locator('[data-toast-type="warning"]')).toHaveText(t(`settings.email.compose.${operation === 'save' ? 'draftNotReplaced' : 'draftNotRemoved'}`))
      assert.equal(operation === 'save' ? saved.length : sent.length, operation === 'save' ? 2 : 1)
      assert.deepEqual(errors, [])
    } finally { await page.close() }
  })
}

test('HTTP 502 send failure keeps the composer, body and attachment intact for a successful retry', async () => {
  const { page, errors } = await visit('en')
  try {
    await composeItinerary(page)
    sendFailure = true
    await page.getByRole('button', { name: t('settings.email.compose.send'), exact: true }).click()
    await expect(page.locator('[data-toast-type="error"]')).toHaveText(t('settings.email.errors.smtp_failed'))
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('textbox', { name: t('settings.email.compose.body'), exact: true })).toHaveValue('Your itinerary is attached.')
    await expect(page.getByText('itinerary.txt', { exact: true })).toBeVisible()
    assert.equal(sent.length, 0)
    sendFailure = false
    await page.getByRole('button', { name: t('settings.email.compose.send'), exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    assert.equal(sent.length, 1)
    assert.equal(Buffer.from(sent[0].attachments[0].content, 'base64').toString(), 'Hotel itinerary')
    assert.deepEqual(errors.filter((error) => !error.includes('502 (Bad Gateway)')), [], 'only the deliberately failed HTTP request may report a browser error')
  } finally { await page.close() }
})

test('Permanent deletion requires native confirmation: cancel leaves mail intact, accept deletes from trash', async () => {
  const { page, errors } = await visit('en')
  try {
    messages[0].folder = 'trash'
    await page.getByRole('tab', { name: t('settings.email.folders.trash'), exact: true }).click()
    await page.getByRole('checkbox', { name: t('settings.email.inbox.selectAll'), exact: true }).check()
    const remove = page.getByRole('button', { name: t('settings.email.actions.deleteForever'), exact: true })
    page.once('dialog', async (dialog) => { assert.equal(dialog.type(), 'confirm'); await dialog.dismiss() })
    await remove.click()
    assert.deepEqual(mutations, [])
    await expect(page.getByRole('button', { name: /Reservation question/ })).toBeVisible()
    page.once('dialog', async (dialog) => { assert.equal(dialog.message(), t('settings.email.inbox.deleteConfirm')); await dialog.accept() })
    await remove.click()
    await expect.poll(() => mutations.length).toBe(1)
    assert.deepEqual(mutations[0], { folder: 'trash', uids: [1], action: 'deleteForever' })
    await expect(page.getByRole('button', { name: /Reservation question/ })).toHaveCount(0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { JOURNAL_CHART } from '../src/modules/accounting/journal/chart'
import type { JournalWorkspace, JournalStatement } from '../src/modules/accounting/journal/types'
import en from '../src/i18n/locales/en.json'

const label = (key: string) => (en.accounting.journal as Record<string, unknown>)[key] as string

const accountantMode = (page: import('@playwright/test').Page) => page.getByRole('button', { name: label('accountantView'), exact: true }).click()

let server: Server
let baseURL: string
const contactId = '00000000-0000-4000-8000-000000000002'
const workspace: JournalWorkspace = {
  accounts: JOURNAL_CHART.map((account) => ({ ...account, debit: '0.00', credit: '0.00', balance: '0.00' })),
  entries: [], revaluations: [], periods: [], parties: [], contacts: [{ id: contactId, name: 'Test guest' }],
  health: { debit: '0.00', credit: '0.00', balanced: true, entryCount: 0 },
  functionalCurrency: 'EGP', valuation: 'native', reportingCoverage: { valued: 0, unvalued: 0, warning: null },
  owner: { cash: '100.00', receivable: '20.00', payable: '10.00', monthRevenue: '80.00', monthExpenses: '30.00', monthProfit: '50.00' },
  trend: [{ date: '2026-10-01', revenue: '80.00', expenses: '30.00', profit: '50.00', cashIn: '100.00', cashOut: '30.00' }],
  reports: { available: true, trialBalance: [{ code: '1101', nameEn: 'Cash on hand', nameAr: 'النقدية بالصندوق', type: 'asset', openingDebit: '70.00', openingCredit: '0.00', periodDebit: '100.00', periodCredit: '30.00', closingDebit: '140.00', closingCredit: '0.00' }], incomeStatement: { revenue: '80.00', expenses: '30.00', profit: '50.00' }, balanceSheet: { asOf: '2026-10-31', assets: '160.00', liabilities: '10.00', equity: '100.00', currentEarnings: '50.00', balanced: true } },
}

test.beforeAll(async () => {
  const rootRequire = createRequire(resolve('package.json'))
  const requireFromTsx = createRequire(rootRequire.resolve('tsx'))
  const esbuild = requireFromTsx('esbuild') as { build: (options: Record<string, unknown>) => Promise<{ outputFiles: { text: string }[] }> }
  const build = await esbuild.build({
    entryPoints: [resolve('e2e/fixtures/journal.tsx')], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'client-only', setup(builder: { onResolve: (options: { filter: RegExp }, callback: () => { path: string; namespace: string }) => void; onLoad: (options: { filter: RegExp; namespace: string }, callback: () => { contents: string }) => void }) {
      builder.onResolve({ filter: /^client-only$/ }, () => ({ path: 'client-only', namespace: 'empty' }))
      builder.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '' }))
    } }],
  })
  const cssFolder = resolve(process.env.JOURNAL_TEST_DIST ?? '.next', 'static/chunks')
  const css = existsSync(cssFolder) ? readdirSync(cssFolder).filter((file) => file.endsWith('.css')).map((file) => readFileSync(join(cssFolder, file), 'utf8')).join('\n') : ''
  if (!css) throw new Error('Build the app before running the journal browser checks so responsive styles are tested')
  server = createServer((request, response) => {
    if (request.url === '/bundle.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(build.outputFiles[0].text) }
    else if (request.url === '/style.css') { response.setHeader('Content-Type', 'text/css'); response.end(css) }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>') }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Unable to start client test harness')
  baseURL = `http://127.0.0.1:${address.port}`
})
test.afterAll(async () => {
  if (!server) return
  server.closeAllConnections()
  await new Promise<void>((done) => server.close(() => done()))
})

test.beforeEach(async ({ page }) => {
  await page.route('**/api/accounting/journal?**', (route) => {
    const params = new URL(route.request().url()).searchParams
    const valuation = params.get('valuation') === 'functional' ? 'functional' : 'native'
    return route.fulfill({ json: { data: { ...workspace, valuation } } })
  })
  await page.goto(baseURL)
  await expect(page.getByRole('button', { name: 'New journal entry' })).toBeEnabled()
})

test('simple movement sends exact amounts and accounts to the API', async ({ page }) => {
  let posted: unknown
  await page.route('**/api/accounting/journal', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { data: {} } }) })
  await page.getByRole('button', { name: 'New journal entry' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Description', { exact: true }).fill('Opening capital')
  const accounts = dialog.getByLabel('Account', { exact: true })
  await accounts.nth(0).selectOption('3101')
  await accounts.nth(1).selectOption('1101')
  await dialog.getByLabel('Amount', { exact: true }).fill('0.30')
  await dialog.getByRole('button', { name: 'Post entry', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(posted).toMatchObject({ currency: 'EGP', description: 'Opening capital', lines: [{ accountCode: '3101', debit: '0', credit: '0.30' }, { accountCode: '1101', debit: '0.30', credit: '0' }] })
})

test('advanced form blocks an unbalanced entry and balances fractional cents exactly', async ({ page }) => {
  await page.getByRole('button', { name: 'New journal entry' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Advanced entry with multiple lines').check()
  await dialog.getByLabel('Debit', { exact: true }).nth(0).fill('0.30')
  await dialog.getByLabel('Credit', { exact: true }).nth(1).fill('0.31')
  await expect(dialog.getByRole('button', { name: 'Post entry', exact: true })).toBeDisabled()
  await dialog.getByLabel('Credit', { exact: true }).nth(1).fill('0.30')
  await expect(dialog.getByRole('button', { name: 'Post entry', exact: true })).toBeEnabled()
})

test('permanent period lock requires an explicit confirmation', async ({ page }) => {
  let posted: unknown
  await page.route('**/api/accounting/journal/periods', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { data: {} } }) })
  await accountantMode(page)
  await page.getByRole('button', { name: 'Accounting periods', exact: true }).click()
  await page.getByRole('button', { name: 'Lock permanently', exact: true }).click()
  expect(posted).toBeUndefined()
  await expect(page.getByRole('dialog')).toContainText('cannot be undone')
  await page.getByRole('dialog').getByRole('button', { name: 'Lock permanently', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  expect(posted).toMatchObject({ action: 'lock' })
})

test('Arabic screens and forms fit the viewport without console errors', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${baseURL}/?locale=ar`)
  await expect(page.getByRole('heading', { name: 'دفتر اليومية العام' })).toBeVisible()
  await page.getByRole('button', { name: 'قيد يومية جديد' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('journal-ar.png'), fullPage: true })
})

test('owner dashboard switches charts and exposes exact underlying figures', async ({ page }) => {
  await expect(page.getByRole('img')).toHaveAccessibleName(new RegExp(label('monthRevenue')))
  await page.getByRole('button', { name: label('cashMovement'), exact: true }).click()
  await expect(page.getByRole('img')).toHaveAccessibleName(new RegExp(label('cashIn')))
  await page.getByRole('button', { name: label('viewFigures'), exact: true }).click()
  const table = page.getByRole('table')
  await expect(table).toContainText('2026-10-01')
  await expect(table).toContainText('100.00')
  await expect(table).toContainText('30.00')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('owner quick record opens a prefilled two-account movement and remembers the chosen mode', async ({ page }) => {
  let posted: unknown
  await page.route('**/api/accounting/journal', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { data: {} } }) })
  await page.getByRole('button', { name: new RegExp(label('cashExpenseHint')) }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Description', { exact: true })).toHaveValue(label('cashExpense'))
  await dialog.getByLabel('Amount', { exact: true }).fill('12.50')
  await dialog.getByRole('button', { name: 'Post entry', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(posted).toMatchObject({ lines: [{ accountCode: '1101', credit: '12.50' }, { accountCode: '5501', debit: '12.50' }] })
  await accountantMode(page)
  await page.reload()
  await expect(page.getByRole('button', { name: label('accountantView'), exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('foreign posting sends the exact rate and source without converting native amounts in the client', async ({ page }) => {
  let posted: unknown
  await page.route('**/api/accounting/journal', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { data: {} } }) })
  await page.getByLabel('Currency', { exact: true }).selectOption('USD')
  await expect(page.getByRole('button', { name: 'New journal entry' })).toBeEnabled()
  await page.getByRole('button', { name: 'New journal entry' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Description', { exact: true }).fill('Foreign opening capital')
  await dialog.getByLabel('Account', { exact: true }).nth(0).selectOption('3101')
  await dialog.getByLabel('Account', { exact: true }).nth(1).selectOption('1101')
  await dialog.getByLabel('Amount', { exact: true }).fill('10.25')
  await dialog.getByLabel(label('exchangeRate'), { exact: true }).fill('48.12345678')
  await dialog.getByLabel(label('rateSource'), { exact: true }).fill('Bank transaction receipt')
  await dialog.getByRole('button', { name: 'Post entry', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(posted).toMatchObject({ currency: 'USD', exchangeRate: '48.12345678', exchangeRateSource: 'Bank transaction receipt', lines: [{ credit: '10.25', debit: '0' }, { debit: '10.25', credit: '0' }] })
})

test('closing revaluation submits rates and references while leaving valuation amounts to the server', async ({ page }) => {
  let posted: Record<string, unknown> | undefined
  await page.route('**/api/accounting/journal/revaluation', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { data: {} } }) })
  await accountantMode(page)
  await page.getByRole('button', { name: label('revaluation'), exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Entry date', { exact: true }).fill('2026-10-31')
  await dialog.getByLabel('Currency', { exact: true }).selectOption('EUR')
  await dialog.getByLabel('Account', { exact: true }).selectOption('1201')
  await dialog.getByLabel('Contact', { exact: true }).selectOption(contactId)
  await dialog.getByLabel(label('closingRate'), { exact: true }).fill('52.12345678')
  await dialog.getByLabel(label('rateSource'), { exact: true }).fill('Bank closing quotation')
  await dialog.getByRole('button', { name: label('postRevaluation'), exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect(posted).toEqual({ date: '2026-10-31', currency: 'EUR', accountCode: '1201', contactId, closingRate: '52.12345678', source: 'Bank closing quotation' })
})

test('functional valuation requests EGP explicitly and disables the native currency selector', async ({ page }) => {
  const request = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return url.pathname === '/api/accounting/journal' && url.searchParams.get('valuation') === 'functional' && url.searchParams.get('currency') === 'EGP'
  })
  await accountantMode(page)
  await page.getByLabel(label('valuation'), { exact: true }).selectOption('functional')
  await request
  await expect(page.getByLabel('Currency', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'New journal entry' })).toBeEnabled()
  await page.getByLabel(label('valuation'), { exact: true }).selectOption('native')
  await expect(page.getByLabel('Currency', { exact: true })).toBeEnabled()
})

test('missing historical FX snapshots block functional financial exports while native reports stay available', async ({ page }) => {
  await page.route('**/api/accounting/journal?**', (route) => {
    const valuation = new URL(route.request().url()).searchParams.get('valuation')
    const missing = valuation === 'functional'
    return route.fulfill({ json: { data: { ...workspace, valuation, reportingCoverage: { valued: 0, unvalued: missing ? 1 : 0, warning: missing ? 'Missing historical rate' : null }, reports: { ...workspace.reports, available: !missing } } } })
  })
  await accountantMode(page)
  await page.getByLabel(label('valuation'), { exact: true }).selectOption('functional')
  await page.getByRole('button', { name: label('reports'), exact: true }).click()
  await expect(page.getByRole('button', { name: label('exportCsv'), exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: label('exportPdf'), exact: true })).toBeDisabled()
  await expect(page.getByRole('alert')).toContainText(label('coverageWarning'))
  await page.getByLabel(label('valuation'), { exact: true }).selectOption('native')
  await expect(page.getByRole('button', { name: label('exportCsv'), exact: true })).toBeEnabled()
})

test('reports download real CSV and PDF artifacts', async ({ page }) => {
  await accountantMode(page)
  await page.getByRole('button', { name: label('reports'), exact: true }).click()
  await expect(page.getByRole('table')).toContainText('140.00')
  const csvEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: label('exportCsv'), exact: true }).click()
  const csv = await csvEvent
  expect(csv.suggestedFilename()).toMatch(/^journal-trialBalance-.*-EGP-native\.csv$/)
  const csvPath = await csv.path()
  expect(csvPath).not.toBeNull()
  const content = readFileSync(csvPath!, 'utf8')
  expect(content).toContain('140.00')
  expect(content).toContain('EGP')
  const pdfEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: label('exportPdf'), exact: true }).click()
  const pdf = await pdfEvent
  expect(pdf.suggestedFilename()).toMatch(/^journal-trialBalance-.*-EGP-native\.pdf$/)
  const pdfPath = await pdf.path()
  expect(pdfPath).not.toBeNull()
  expect(readFileSync(pdfPath!).subarray(0, 5).toString()).toBe('%PDF-')
})

test('statement filters reach the API and downloaded CSV contains the running balance', async ({ page }) => {
  const requests: URLSearchParams[] = []
  await page.route('**/api/accounting/journal/statement?**', (route) => {
    const params = new URL(route.request().url()).searchParams
    requests.push(params)
    const statement: JournalStatement = { accountCode: params.get('accountCode')!, currency: 'EGP', valuation: params.get('valuation') as 'native' | 'functional', month: params.get('month')!, opening: '70.00', closing: '140.00', available: true, warning: null,
      lines: [{ entryId: '00000000-0000-4000-8000-000000000003', entryNumber: 'JE-TEST', date: '2026-10-01', description: 'Guest receipt', contactId, contactName: 'Test guest', debit: '70.00', credit: '0.00', runningBalance: '140.00' }] }
    return route.fulfill({ json: { data: statement } })
  })
  await page.route('**/api/accounting/journal?**', (route) => route.fulfill({ json: { data: { ...workspace, parties: [{ contactId, name: 'Test guest', debit: '20.00', credit: '0.00', balance: '20.00', receivable: '20.00', payable: '0.00', deposits: '0.00' }] } } }))
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New journal entry' })).toBeEnabled()
  await accountantMode(page)
  await page.getByRole('button', { name: label('reports'), exact: true }).click()
  await page.getByLabel(label('reportType'), { exact: true }).selectOption('statement')
  await expect(page.getByRole('table').last()).toContainText('Guest receipt')
  await page.getByLabel('Account', { exact: true }).selectOption('1201')
  await page.getByLabel('Contact', { exact: true }).selectOption(contactId)
  await expect.poll(() => requests.some((params) => params.get('accountCode') === '1201' && params.get('contactId') === contactId && params.get('valuation') === 'native' && params.get('currency') === 'EGP')).toBe(true)
  await expect(page.getByRole('button', { name: label('exportCsv'), exact: true })).toBeEnabled()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: label('exportCsv'), exact: true }).click()
  const download = await downloadEvent
  const path = await download.path()
  expect(readFileSync(path!, 'utf8')).toContain('140.00')
})

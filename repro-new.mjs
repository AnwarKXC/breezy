import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.test', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const BASE = process.env.REPRO_BASE || 'http://localhost:3100'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(`${BASE}/en/login`, { waitUntil: 'networkidle' })
  await page.getByLabel(/email/i).fill(env.TEST_ADMIN_EMAIL)
  await page.getByLabel(/password/i).fill(env.TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in|login|submit/i }).click()
  await page.waitForTimeout(3500)
  console.log('after login URL:', page.url())

  await page.goto(`${BASE}/en/reservations`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  const addBtn = page.getByRole('button', { name: /add booking|new reservation/i }).first()
  const addBtnVisible = await addBtn.isVisible().catch(() => false)
  console.log('Add booking button visible:', addBtnVisible)
  if (addBtnVisible) {
    await addBtn.click()
    await page.waitForTimeout(4000)
    console.log('URL after Add booking click:', page.url())
    console.log('  detail error visible:', await page.getByText(/could not be loaded/i).isVisible().catch(() => false))
    console.log('  new-form marker visible:', await page.getByText(/new reservation/i).first().isVisible().catch(() => false))
  }

  await page.goto(`${BASE}/en/reservations/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  console.log('direct /new URL:', page.url())
  console.log('  detail error visible:', await page.getByText(/could not be loaded/i).isVisible().catch(() => false))
  const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 400)
  console.log('  body snippet:', bodyText.replace(/\n/g, ' | ').slice(0, 300))

  await browser.close()
}

main().catch((e) => {
  console.error('REPRO FAILED:', e.message)
  process.exit(1)
})

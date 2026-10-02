/** Real shared components and compiled app CSS, isolated from hotel data.
 * Run: pnpm exec tsx --test scripts/verify-theme.browser.ts
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from '@playwright/test'
import { AnalyticsCard } from '../src/shared/components/AnalyticsCard'
import { TableCheckbox } from '../src/shared/components/TableCheckbox'
import { TableDesktopView } from '../src/shared/components/TableDesktopView'
import { PRIMARY_COLOR_PRESETS, themeCssVars } from '../src/shared/theme/theme'

test('theme reaches shared surfaces, selections and focus in desktop/mobile LTR/RTL', async () => {
  const root = process.cwd()
  const require = createRequire(path.join(root, 'package.json'))
  const postcss = createRequire(require.resolve('@tailwindcss/postcss'))('postcss')
  const css = (await postcss([require('@tailwindcss/postcss')({ base: root })]).process(
    await readFile('src/app/globals.css', 'utf8'), { from: path.join(root, 'src/app/globals.css') },
  )).css
  const markup = renderToStaticMarkup(h('main', { className: 'bg-page-bg p-4 space-y-4' },
    h('button', { id: 'primary', className: 'bg-accent text-accent-foreground hover:bg-accent-hover rounded-lg px-4 py-2' }, 'New reservation'),
    h('a', { id: 'active', href: '#', className: 'bg-accent/10 text-accent-ink rounded-md px-4 py-2 inline-block' }, 'Reservations'),
    h(AnalyticsCard, { label: 'Occupancy', value: '72%' }),
    h('input', { id: 'field', 'aria-label': 'Guest name', placeholder: 'Guest name' }),
    h('input', { id: 'native', type: 'checkbox', 'aria-label': 'Include archived' }),
    h(TableCheckbox, { checked: true, label: 'Select reservation', onChange: () => {} }),
    h(TableDesktopView, {
      columns: [{ key: 'guest', label: 'Guest' }], data: [{ id: '1', guest: 'Alex Morgan' }],
      getRowId: () => '1', selectedRowIdSet: new Set(['1']), isSelectable: false,
      allPageRowsSelected: false, somePageRowsSelected: false, selectionLabel: 'Select reservation',
      sortable: false, sort: { key: '', direction: 'asc' },
      onPageSelectionChange: () => {}, onRowSelectionChange: () => {}, onSort: () => {},
    }),
  ))
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent(`<style>${css}</style>${markup}`)
    // tsx preserves names through this helper when serializing browser callbacks.
    await page.evaluate('window.__name = (fn) => fn')
    for (const primary of [...PRIMARY_COLOR_PRESETS, '#FFFFFF', '#FFFF00']) {
      await page.evaluate((vars) => {
        for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, value)
      }, themeCssVars(primary))
      await page.locator('#field').focus()
      await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)))
      const styles = await page.evaluate(() => {
        const style = (selector: string) => getComputedStyle(document.querySelector(selector)!)
        const rgba = (color: string) => {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = 1
          const ctx = canvas.getContext('2d')!
          ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1)
          return [...ctx.getImageData(0, 0, 1, 1).data]
        }
        return {
          primary: rgba(style('#primary').backgroundColor), focus: rgba(style('#field').borderColor),
          soft: rgba(style('#active').backgroundColor), selected: rgba(style('tbody tr').backgroundColor),
          checkbox: rgba(style('[role="checkbox"] span').backgroundColor),
          native: rgba(style('#native').accentColor), ring: style('#field').boxShadow,
          ink: rgba(style('#active').color), text: rgba(style('#primary').color),
        }
      })
      assert.deepEqual(styles.focus, styles.ink, `${primary}: visible input focus`)
      assert.deepEqual(styles.checkbox, styles.primary, `${primary}: shared checkbox`)
      assert.deepEqual(styles.native, styles.primary, `${primary}: native checkbox`)
      assert.deepEqual(styles.selected, styles.soft, `${primary}: selected table row`)
      assert.ok(styles.soft[3] >= 25 && styles.soft[3] <= 26, `${primary}: 10% opacity`)
      assert.notEqual(styles.ring, 'none')
      assert.ok(styles.ink.slice(0, 3).every((channel) => channel <= 103), `${primary}: readable tinted text`)
      await page.locator('#primary').hover()
      const contrast = await page.locator('#primary').evaluate((button) => {
        const ctx = document.createElement('canvas').getContext('2d')!
        const luminance = (color: string) => {
          ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1)
          const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
            const channel = value / 255
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
          })
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
        }
        const style = getComputedStyle(button)
        const bg = luminance(style.backgroundColor), fg = luminance(style.color)
        return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05)
      })
      assert.ok(contrast >= 4.5, `${primary}: hover contrast ${contrast}`)
      await page.mouse.move(0, 0)
    }
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const dir of ['ltr', 'rtl']) {
        await page.evaluate((direction) => { document.documentElement.dir = direction }, dir)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px ${dir}: overflow`)
      }
    }
  } finally {
    await browser.close()
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { foregroundFor, PRIMARY_COLOR_PRESETS, themeCssVars } from './theme'

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

test('solid theme text meets WCAG AA for presets and custom light/mid-tone colors', () => {
  for (const primary of [...PRIMARY_COLOR_PRESETS, '#FFFFFF', '#FFFF00', '#00FF00', '#808080', '#777777', '#FF8800', '#000000']) {
    const background = luminance(primary)
    const foreground = luminance(foregroundFor(primary))
    const contrast = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
    assert.ok(contrast >= 4.5, `${primary}: ${contrast}`)
    assert.equal(themeCssVars(primary)['--app-primary-foreground'], foregroundFor(primary))
  }
})

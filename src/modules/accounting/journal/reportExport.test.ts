import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell, sectionsToCsv } from './reportExport'

test('CSV preserves exact decimals and quoted multiline descriptions', () => {
  assert.equal(csvCell('1234567890.12'), '"1234567890.12"')
  assert.equal(csvCell('Guest "A"\nSuite'), '"Guest ""A""\nSuite"')
  assert.equal(csvCell('-10.25'), '"-10.25"')
  assert.ok(sectionsToCsv([{ title: 'Report', headers: ['Currency', 'Amount'], rows: [['USD', '0.30']] }]).includes('"USD","0.30"'))
})
test('CSV descriptions cannot execute spreadsheet formulas', () => {
  for (const value of ['=HYPERLINK("evil")', '+SUM(1,1)', '-cmd|evil', '@SUM(1)', '\t=1+1', ' \r=1']) assert.ok(csvCell(value).startsWith('"\''))
})

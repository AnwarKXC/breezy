import ExcelJS from 'exceljs'
import type { Expense } from '../types'

function groupByCategory(expenses: Expense[], categoryNames: Record<string, string>): [string, Expense[]][] {
  const grouped = new Map<string, Expense[]>()
  for (const exp of expenses) {
    const categoryName = categoryNames[exp.categoryId] ?? exp.categoryId
    const list = grouped.get(categoryName) ?? []
    list.push(exp)
    grouped.set(categoryName, list)
  }
  return Array.from(grouped.entries())
}

const GREEN_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2E7D32' },
}

const GREEN_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' },
  bold: true,
  size: 12,
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF5F5F5' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 11,
}

export async function exportExpensesCsv(expenses: Expense[], categoryNames: Record<string, string>, fileName: string): Promise<void> {
  const grouped = groupByCategory(expenses, categoryNames)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Expenses')

  // Set column widths
  sheet.columns = [
    { width: 20 },
    { width: 40 },
    { width: 15 },
    { width: 5 },
    { width: 5 },
  ]

  let grandTotal = 0

  for (const [categoryName, categoryExpenses] of grouped) {
    // Category header row - merged across 5 columns, green background, centered
    const categoryRow = sheet.addRow([categoryName, '', '', '', ''])
    sheet.mergeCells(categoryRow.number, 1, categoryRow.number, 5)
    categoryRow.eachCell((cell) => {
      cell.fill = GREEN_FILL
      cell.font = GREEN_FONT
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    categoryRow.height = 28

    // Column headers
    const headerRow = sheet.addRow(['Date', 'Description', 'Amount', '', ''])
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL
      cell.font = HEADER_FONT
      cell.alignment = { horizontal: 'center' }
    })

    // Expense rows
    let categoryTotal = 0
    for (const exp of categoryExpenses) {
      const amount = Number(exp.totalAmount ?? exp.amount ?? 0)
      categoryTotal += amount
      sheet.addRow([exp.date, exp.description, amount, '', ''])
    }

    // Subtotal
    const subtotalRow = sheet.addRow(['', 'Subtotal', categoryTotal, '', ''])
    subtotalRow.getCell(2).font = { bold: true }
    subtotalRow.getCell(3).font = { bold: true }
    subtotalRow.getCell(3).alignment = { horizontal: 'right' }

    // Blank separator row
    sheet.addRow(['', '', '', '', ''])

    grandTotal += categoryTotal
  }

  // Grand total
  const totalRow = sheet.addRow(['', 'Total', grandTotal, '', ''])
  totalRow.eachCell((cell) => {
    cell.fill = GREEN_FILL
    cell.font = { ...GREEN_FONT, size: 12 }
  })
  totalRow.getCell(3).alignment = { horizontal: 'right' }

  // Add borders to all data cells
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD4D4D4' } },
        bottom: { style: 'thin', color: { argb: 'FFD4D4D4' } },
        left: { style: 'thin', color: { argb: 'FFD4D4D4' } },
        right: { style: 'thin', color: { argb: 'FFD4D4D4' } },
      }
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.replace(/\.csv$/, '.xlsx')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

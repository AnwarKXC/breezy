import type { JournalAccountType } from './types'

export interface JournalChartAccount {
  code: string; nameEn: string; nameAr: string; type: JournalAccountType
  parentCode: string | null; postable: boolean; requiresContact: boolean
}
const account = (code: string, nameEn: string, nameAr: string, type: JournalAccountType, parentCode: string | null = null, requiresContact = false): JournalChartAccount => ({ code, nameEn, nameAr, type, parentCode, postable: parentCode !== null, requiresContact })
// Hotel-specific starting chart; operational invoices/payments are not posted automatically.
export const JOURNAL_CHART: JournalChartAccount[] = [
  account('1', 'Assets', 'الأصول', 'asset'),
  account('1101', 'Cash on hand', 'النقدية بالصندوق', 'asset', '1'),
  account('1102', 'Bank accounts', 'الحسابات البنكية', 'asset', '1'),
  account('1201', 'Guest and company receivables', 'ذمم النزلاء والشركات', 'asset', '1', true),
  account('1301', 'Inventory and supplies', 'المخزون والمستلزمات', 'asset', '1'),
  account('1401', 'Property and equipment', 'الممتلكات والمعدات', 'asset', '1'),
  account('2', 'Liabilities', 'الالتزامات', 'liability'),
  account('2101', 'Supplier payables', 'ذمم الموردين', 'liability', '2', true),
  account('2201', 'Guest deposits', 'تأمينات النزلاء', 'liability', '2', true),
  account('2301', 'Taxes payable', 'الضرائب المستحقة', 'liability', '2'),
  account('3', 'Equity', 'حقوق الملكية', 'equity'),
  account('3101', 'Owner capital', 'رأس المال', 'equity', '3'),
  account('3201', 'Retained earnings', 'الأرباح المحتجزة', 'equity', '3'),
  account('4', 'Revenue', 'الإيرادات', 'revenue'),
  account('4101', 'Room revenue', 'إيرادات الغرف', 'revenue', '4'),
  account('4201', 'Food and beverage revenue', 'إيرادات الطعام والشراب', 'revenue', '4'),
  account('4301', 'Other services revenue', 'إيرادات الخدمات الأخرى', 'revenue', '4'),
  account('4401', 'Realized foreign exchange gains', 'أرباح فروق العملة المحققة', 'revenue', '4'),
  account('4402', 'Unrealized foreign exchange gains', 'أرباح فروق العملة غير المحققة', 'revenue', '4'),
  account('5', 'Expenses', 'المصروفات', 'expense'),
  account('5101', 'Salaries and wages', 'الرواتب والأجور', 'expense', '5'),
  account('5201', 'Utilities', 'المرافق', 'expense', '5'),
  account('5301', 'Housekeeping and supplies', 'النظافة والمستلزمات', 'expense', '5'),
  account('5401', 'Maintenance', 'الصيانة', 'expense', '5'),
  account('5501', 'Administrative expenses', 'المصروفات الإدارية', 'expense', '5'),
  account('5601', 'Realized foreign exchange losses', 'خسائر فروق العملة المحققة', 'expense', '5'),
  account('5602', 'Unrealized foreign exchange losses', 'خسائر فروق العملة غير المحققة', 'expense', '5'),
]

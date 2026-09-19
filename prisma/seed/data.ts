// Essential data required for a fresh install. IDs are FIXED so the seed is
// idempotent and rows can be referenced from code/tests across environments.
// Never change an existing id; append new rows with a new id.

export const ACCOUNTING_SETTINGS = [
  { id: '00000000-0000-4000-a000-000000000001', key: 'currency', value: { code: 'EGP', symbol: 'EGP' }, description: 'System currency' },
  { id: '00000000-0000-4000-a000-000000000002', key: 'vat_rate', value: { rate: 14 }, description: 'VAT percentage' },
  { id: '00000000-0000-4000-a000-000000000003', key: 'service_charge_rate', value: { rate: 10 }, description: 'Service charge percentage' },
] as const

export const EXPENSE_CATEGORIES = [
  { id: '00000000-0000-4000-b000-000000000001', name: 'Salaries', name_ar: 'رواتب' },
  { id: '00000000-0000-4000-b000-000000000002', name: 'Utilities', name_ar: 'مرافق' },
  { id: '00000000-0000-4000-b000-000000000003', name: 'Maintenance', name_ar: 'صيانة' },
  { id: '00000000-0000-4000-b000-000000000004', name: 'Housekeeping Supplies', name_ar: 'مستلزمات التدبير' },
  { id: '00000000-0000-4000-b000-000000000005', name: 'Food & Beverage', name_ar: 'أطعمة ومشروبات' },
  { id: '00000000-0000-4000-b000-000000000006', name: 'Marketing', name_ar: 'تسويق' },
  { id: '00000000-0000-4000-b000-000000000007', name: 'Taxes & Fees', name_ar: 'ضرائب ورسوم' },
  { id: '00000000-0000-4000-b000-000000000008', name: 'Other', name_ar: 'أخرى' },
] as const

export const ROOM_TYPES = [
  { id: '00000000-0000-4000-c000-000000000001', name: 'Single', slug: 'single', default_capacity: 1 },
  { id: '00000000-0000-4000-c000-000000000002', name: 'Double', slug: 'double', default_capacity: 2 },
  { id: '00000000-0000-4000-c000-000000000003', name: 'Triple', slug: 'triple', default_capacity: 3 },
  { id: '00000000-0000-4000-c000-000000000004', name: 'Suite', slug: 'suite', default_capacity: 4 },
] as const

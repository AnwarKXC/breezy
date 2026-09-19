ALTER TABLE public.expense_categories ADD COLUMN name_ar TEXT;

UPDATE public.expense_categories SET name_ar = 'راتب' WHERE name = 'Salary';
UPDATE public.expense_categories SET name_ar = 'مرافق' WHERE name = 'Utilities';
UPDATE public.expense_categories SET name_ar = 'صيانة' WHERE name = 'Maintenance';
UPDATE public.expense_categories SET name_ar = 'لوازم' WHERE name = 'Supplies';
UPDATE public.expense_categories SET name_ar = 'تسويق' WHERE name = 'Marketing';
UPDATE public.expense_categories SET name_ar = 'أخرى' WHERE name = 'Other';

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounting_users_all" ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
  );

CREATE POLICY "accounting_users_all" ON public.expense_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
  );

CREATE POLICY "accounting_users_all" ON public.expenses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'accountant'))
  );

INSERT INTO public.expense_categories (name, description) VALUES
  ('Salary', 'Employee salaries and wages'),
  ('Utilities', 'Electricity, water, gas, internet'),
  ('Maintenance', 'Building and equipment maintenance'),
  ('Supplies', 'Office and operational supplies'),
  ('Marketing', 'Advertising and marketing expenses'),
  ('Other', 'Miscellaneous expenses');

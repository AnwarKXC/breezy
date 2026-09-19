CREATE TABLE public.expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  deleted_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX idx_expenses_date ON public.expenses(date);
CREATE INDEX idx_expenses_deleted_at ON public.expenses(deleted_at);

CREATE TYPE payment_type AS ENUM ('instapay', 'vodafone_cash', 'cash', 'bank_transfer', 'visa');

CREATE TABLE public.payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  type          payment_type NOT NULL,
  amount        NUMERIC NOT NULL CHECK (amount != 0),
  description   TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_payments_created_at ON public.payments(created_at);

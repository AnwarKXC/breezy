-- Closing-rate revaluation. A revaluation entry adjusts EGP carrying values only:
-- its lines carry zero transaction-currency amounts, so native balances never change.
BEGIN;
ALTER TABLE public.accounting_journal_entries
  ADD COLUMN kind text NOT NULL DEFAULT 'manual',
  ADD CONSTRAINT journal_kind_valid CHECK (kind IN ('manual','revaluation')),
  ADD CONSTRAINT journal_revaluation_shape CHECK (kind = 'manual' OR (reversal_of_id IS NULL AND currency <> 'EGP'));

-- Allow zero native amounts only when exactly one functional side is positive;
-- the deferred validators restrict such lines to revaluation entries.
ALTER TABLE public.accounting_journal_lines DROP CONSTRAINT accounting_journal_lines_check;
ALTER TABLE public.accounting_journal_lines ADD CONSTRAINT journal_line_sides CHECK (
  (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  OR (debit = 0 AND credit = 0 AND ((COALESCE(base_debit, 0) > 0 AND COALESCE(base_credit, 0) = 0) OR (COALESCE(base_credit, 0) > 0 AND COALESCE(base_debit, 0) = 0)))
);
ALTER TABLE public.accounting_journal_lines DROP CONSTRAINT journal_base_sides;
ALTER TABLE public.accounting_journal_lines ADD CONSTRAINT journal_base_sides CHECK (
  (base_debit IS NULL AND base_credit IS NULL) OR
  (base_debit IS NOT NULL AND base_credit IS NOT NULL AND base_debit >= 0 AND base_credit >= 0
    AND ((debit = 0 AND credit = 0) OR ((debit <> 0 OR base_debit = 0) AND (credit <> 0 OR base_credit = 0))))
);

CREATE TABLE public.accounting_revaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL UNIQUE REFERENCES public.accounting_journal_entries(id) ON DELETE RESTRICT,
  date date NOT NULL,
  currency text NOT NULL CHECK (currency IN ('USD','EUR','GBP')),
  account_code text NOT NULL REFERENCES public.accounting_accounts(code) ON DELETE RESTRICT CHECK (account_code IN ('1101','1102','1201','2101')),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE RESTRICT,
  closing_rate numeric(18,8) NOT NULL CHECK (closing_rate > 0),
  source text NOT NULL CHECK (length(btrim(source)) BETWEEN 1 AND 200),
  native_balance numeric(30,2) NOT NULL,
  base_before numeric(30,2) NOT NULL,
  base_after numeric(30,2) NOT NULL,
  delta numeric(30,2) NOT NULL CHECK (delta <> 0 AND delta = base_after - base_before),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((account_code IN ('1201','2101')) = (contact_id IS NOT NULL))
);
CREATE INDEX ON public.accounting_revaluations(currency, account_code, date);

CREATE FUNCTION public.accounting_revaluation_before_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE header public.accounting_journal_entries;
BEGIN
  SELECT * INTO header FROM public.accounting_journal_entries WHERE id = NEW.entry_id;
  IF header.kind IS DISTINCT FROM 'revaluation' OR header.date <> NEW.date OR header.currency <> NEW.currency OR header.exchange_rate <> NEW.closing_rate THEN
    RAISE EXCEPTION 'Revaluation record must match its revaluation journal entry' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER revaluation_before_insert BEFORE INSERT ON public.accounting_revaluations FOR EACH ROW EXECUTE FUNCTION public.accounting_revaluation_before_insert();
CREATE TRIGGER revaluations_immutable BEFORE UPDATE OR DELETE ON public.accounting_revaluations FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_immutable();

-- Revaluations are corrected by a later closing-rate operation, never reversed.
CREATE OR REPLACE FUNCTION public.accounting_journal_before_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE period_status text; original public.accounting_journal_entries;
BEGIN
  INSERT INTO public.accounting_periods(month) VALUES(to_char(NEW.date, 'YYYY-MM')) ON CONFLICT DO NOTHING;
  SELECT status INTO period_status FROM public.accounting_periods WHERE month = to_char(NEW.date, 'YYYY-MM') FOR UPDATE;
  IF period_status <> 'open' THEN RAISE EXCEPTION 'Accounting period is not open' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.reversal_of_id IS NOT NULL THEN
    SELECT * INTO original FROM public.accounting_journal_entries WHERE id = NEW.reversal_of_id FOR UPDATE;
    IF original.id IS NULL OR original.reversal_of_id IS NOT NULL OR original.kind <> 'manual' OR original.currency <> NEW.currency OR NEW.date < original.date THEN
      RAISE EXCEPTION 'Invalid journal reversal' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.exchange_rate IS DISTINCT FROM original.exchange_rate
      OR NEW.exchange_rate_date IS DISTINCT FROM original.exchange_rate_date
      OR NEW.exchange_rate_source IS DISTINCT FROM original.exchange_rate_source THEN
      RAISE EXCEPTION 'Reversal must preserve original historical exchange-rate provenance' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0 OR (NEW.currency = 'EGP' AND NEW.exchange_rate <> 1)
      OR NEW.exchange_rate_date IS DISTINCT FROM NEW.date
      OR NEW.exchange_rate_source IS NULL OR length(btrim(NEW.exchange_rate_source)) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'New journals require a positive historical EGP rate, posting-date provenance and source' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Native balancing does not apply to revaluations; manual entries may not carry zero-native lines.
CREATE OR REPLACE FUNCTION public.accounting_journal_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE line_count integer; total_debit numeric; total_credit numeric; header public.accounting_journal_entries;
BEGIN
  IF TG_TABLE_NAME = 'accounting_journal_lines' THEN
    SELECT * INTO header FROM public.accounting_journal_entries WHERE id = NEW.entry_id;
  ELSE header := NEW;
  END IF;
  IF header.kind = 'revaluation' THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.accounting_journal_lines WHERE entry_id = header.id AND debit = 0 AND credit = 0) THEN
    RAISE EXCEPTION 'Manual journal lines require a positive debit or credit' USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*), sum(debit), sum(credit) INTO line_count,total_debit,total_credit FROM public.accounting_journal_lines WHERE entry_id = header.id;
  IF line_count < 2 OR line_count > 100 OR total_debit <> total_credit OR total_debit <= 0 THEN
    RAISE EXCEPTION 'Journal requires 2 to 100 balanced positive lines' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounting_journal_lines WHERE entry_id = header.id GROUP BY account_code,contact_id HAVING sum(debit) <> sum(credit)) THEN
    RAISE EXCEPTION 'Journal must change at least one account or contact balance' USING ERRCODE = 'check_violation';
  END IF;
  IF header.reversal_of_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM (
      SELECT account_code, contact_id, sum(debit) AS debit, sum(credit) AS credit FROM public.accounting_journal_lines WHERE entry_id = header.id GROUP BY account_code,contact_id
    ) reversed FULL JOIN (
      SELECT account_code, contact_id, sum(credit) AS debit, sum(debit) AS credit FROM public.accounting_journal_lines WHERE entry_id = header.reversal_of_id GROUP BY account_code,contact_id
    ) original ON reversed.account_code = original.account_code AND reversed.contact_id IS NOT DISTINCT FROM original.contact_id
    WHERE reversed.debit IS DISTINCT FROM original.debit OR reversed.credit IS DISTINCT FROM original.credit
  ) THEN RAISE EXCEPTION 'Reversal lines must exactly reverse the original entry' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END;
$$;

-- A revaluation is exactly one monetary line and one unrealized gain/loss line, balanced in EGP.
CREATE FUNCTION public.accounting_revaluation_validate(header public.accounting_journal_entries) RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.accounting_journal_lines WHERE entry_id = header.id) <> 2
    OR EXISTS(SELECT 1 FROM public.accounting_journal_lines WHERE entry_id = header.id AND (debit <> 0 OR credit <> 0 OR base_debit IS NULL OR base_credit IS NULL))
    OR (SELECT sum(base_debit) <> sum(base_credit) FROM public.accounting_journal_lines WHERE entry_id = header.id)
    OR (SELECT count(*) FROM public.accounting_journal_lines WHERE entry_id = header.id AND account_code IN ('1101','1102','1201','2101')) <> 1
    OR (SELECT count(*) FROM public.accounting_journal_lines WHERE entry_id = header.id AND ((account_code = '4402' AND base_credit > 0) OR (account_code = '5602' AND base_debit > 0))) <> 1 THEN
    RAISE EXCEPTION 'Revaluation requires one monetary line and one balancing unrealized FX line' USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.accounting_journal_validate_fx() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE header public.accounting_journal_entries; line record; side integer;
  native_total numeric; rounded_total numeric; residual numeric; expected numeric; adjustment numeric;
BEGIN
  IF TG_TABLE_NAME = 'accounting_journal_lines' THEN
    SELECT * INTO header FROM public.accounting_journal_entries WHERE id = NEW.entry_id;
  ELSE header := NEW; END IF;
  IF header.kind = 'revaluation' THEN
    PERFORM public.accounting_revaluation_validate(header);
    RETURN NEW;
  END IF;
  IF header.exchange_rate IS NULL THEN
    -- Only a reversal of an old unvalued entry can create new unvalued lines.
    IF header.reversal_of_id IS NULL OR EXISTS(SELECT 1 FROM public.accounting_journal_lines WHERE entry_id = header.id AND (base_debit IS NOT NULL OR base_credit IS NOT NULL)) THEN
      RAISE EXCEPTION 'Unknown historical valuation must remain explicitly unvalued' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS(SELECT 1 FROM public.accounting_journal_lines WHERE entry_id = header.id AND (base_debit IS NULL OR base_credit IS NULL)) THEN
    RAISE EXCEPTION 'Valued journal requires functional amounts on every line' USING ERRCODE = 'check_violation';
  END IF;
  IF header.reversal_of_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM (
        SELECT account_code,contact_id,sum(base_debit) AS debit,sum(base_credit) AS credit FROM public.accounting_journal_lines WHERE entry_id = header.id GROUP BY account_code,contact_id
      ) reversed FULL JOIN (
        SELECT account_code,contact_id,sum(base_credit) AS debit,sum(base_debit) AS credit FROM public.accounting_journal_lines WHERE entry_id = header.reversal_of_id GROUP BY account_code,contact_id
      ) original ON reversed.account_code = original.account_code AND reversed.contact_id IS NOT DISTINCT FROM original.contact_id
      WHERE reversed.debit IS DISTINCT FROM original.debit OR reversed.credit IS DISTINCT FROM original.credit
    ) THEN RAISE EXCEPTION 'Reversal must preserve the exact inverse original functional values' USING ERRCODE = 'check_violation'; END IF;
    RETURN NEW;
  END IF;
  -- Match the application integer-rational half-up rounding: round each side's
  -- total once, allocating residual cents to largest native lines, then order.
  FOR side IN 0..1 LOOP
    SELECT sum(CASE WHEN side = 0 THEN debit ELSE credit END),
      sum(round((CASE WHEN side = 0 THEN debit ELSE credit END) * header.exchange_rate, 2))
      INTO native_total,rounded_total FROM public.accounting_journal_lines WHERE entry_id = header.id;
    residual := round(native_total * header.exchange_rate, 2) - rounded_total;
    FOR line IN SELECT id,sort_order,
      CASE WHEN side = 0 THEN debit ELSE credit END AS native_amount,
      CASE WHEN side = 0 THEN base_debit ELSE base_credit END AS base_amount
      FROM public.accounting_journal_lines WHERE entry_id = header.id
        AND (CASE WHEN side = 0 THEN debit ELSE credit END) > 0
      ORDER BY (CASE WHEN side = 0 THEN debit ELSE credit END) DESC,sort_order,id
    LOOP
      expected := round(line.native_amount * header.exchange_rate, 2);
      adjustment := greatest(-expected,residual);
      expected := expected + adjustment;
      residual := residual - adjustment;
      IF line.base_amount IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'Functional line value differs from historical rate and deterministic rounding' USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
    IF residual <> 0 THEN RAISE EXCEPTION 'Functional rounding residual could not be allocated' USING ERRCODE = 'check_violation'; END IF;
  END LOOP;
  IF (SELECT sum(base_debit) <> sum(base_credit) FROM public.accounting_journal_lines WHERE entry_id = header.id) THEN
    RAISE EXCEPTION 'Functional debit and credit totals must balance' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.accounting_revaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accounting_revaluations FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accounting_revaluation_before_insert(), public.accounting_revaluation_validate(public.accounting_journal_entries) FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON public.accounting_revaluations FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
COMMIT;

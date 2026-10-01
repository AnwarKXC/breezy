-- Forward, local-only migration: EGP is the confirmed functional currency.
-- Foreign historical rows retain unknown rates; never infer them from today's FX.
BEGIN;
ALTER TABLE public.accounting_journal_entries
  ADD COLUMN exchange_rate numeric(18,8),
  ADD COLUMN exchange_rate_date date,
  ADD COLUMN exchange_rate_source text,
  ADD CONSTRAINT journal_exchange_rate_positive CHECK (exchange_rate IS NULL OR exchange_rate > 0);
ALTER TABLE public.accounting_journal_lines
  ADD COLUMN base_debit numeric(24,2),
  ADD COLUMN base_credit numeric(24,2),
  ADD CONSTRAINT journal_base_sides CHECK (
    (base_debit IS NULL AND base_credit IS NULL) OR
    (base_debit IS NOT NULL AND base_credit IS NOT NULL AND base_debit >= 0 AND base_credit >= 0
      AND (debit <> 0 OR base_debit = 0) AND (credit <> 0 OR base_credit = 0))
  );

-- Only EGP has a known identity rate. Disable immutable triggers solely for this
-- metadata backfill; the migration transaction retains all other protections.
ALTER TABLE public.accounting_journal_entries DISABLE TRIGGER journal_entries_immutable;
ALTER TABLE public.accounting_journal_lines DISABLE TRIGGER journal_lines_immutable;
UPDATE public.accounting_journal_entries e SET exchange_rate = 1,
  exchange_rate_date = COALESCE((SELECT original.date FROM public.accounting_journal_entries original WHERE original.id = e.reversal_of_id), e.date),
  exchange_rate_source = 'legacy-egp'
  WHERE currency = 'EGP';
UPDATE public.accounting_journal_lines l SET base_debit = debit,base_credit = credit
  FROM public.accounting_journal_entries e WHERE e.id = l.entry_id AND e.currency = 'EGP';
ALTER TABLE public.accounting_journal_entries ENABLE TRIGGER journal_entries_immutable;
ALTER TABLE public.accounting_journal_lines ENABLE TRIGGER journal_lines_immutable;

INSERT INTO public.accounting_accounts(code,name_en,name_ar,type,parent_code,postable,requires_contact) VALUES
 ('4401','Realized foreign exchange gains','أرباح فروق العملة المحققة','revenue','4',true,false),
 ('4402','Unrealized foreign exchange gains','أرباح فروق العملة غير المحققة','revenue','4',true,false),
 ('5601','Realized foreign exchange losses','خسائر فروق العملة المحققة','expense','5',true,false),
 ('5602','Unrealized foreign exchange losses','خسائر فروق العملة غير المحققة','expense','5',true,false);

CREATE OR REPLACE FUNCTION public.accounting_journal_before_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE period_status text; original public.accounting_journal_entries;
BEGIN
  INSERT INTO public.accounting_periods(month) VALUES(to_char(NEW.date, 'YYYY-MM')) ON CONFLICT DO NOTHING;
  SELECT status INTO period_status FROM public.accounting_periods WHERE month = to_char(NEW.date, 'YYYY-MM') FOR UPDATE;
  IF period_status <> 'open' THEN RAISE EXCEPTION 'Accounting period is not open' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.reversal_of_id IS NOT NULL THEN
    SELECT * INTO original FROM public.accounting_journal_entries WHERE id = NEW.reversal_of_id FOR UPDATE;
    IF original.id IS NULL OR original.reversal_of_id IS NOT NULL OR original.currency <> NEW.currency OR NEW.date < original.date THEN
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

CREATE FUNCTION public.accounting_journal_validate_fx() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE header public.accounting_journal_entries; line record; side integer;
  native_total numeric; rounded_total numeric; residual numeric; expected numeric; adjustment numeric;
BEGIN
  IF TG_TABLE_NAME = 'accounting_journal_lines' THEN
    SELECT * INTO header FROM public.accounting_journal_entries WHERE id = NEW.entry_id;
  ELSE header := NEW; END IF;
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
CREATE CONSTRAINT TRIGGER journal_fx_balanced AFTER INSERT ON public.accounting_journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_validate_fx();
CREATE CONSTRAINT TRIGGER journal_lines_fx_balanced AFTER INSERT ON public.accounting_journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_validate_fx();
REVOKE EXECUTE ON FUNCTION public.accounting_journal_validate_fx() FROM PUBLIC;
COMMIT;

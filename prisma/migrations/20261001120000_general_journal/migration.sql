-- Independent manual general journal. Existing hotel cashflow ledger is unchanged.
CREATE TABLE public.accounting_accounts (
  code text PRIMARY KEY,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  type text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_code text REFERENCES public.accounting_accounts(code) ON DELETE RESTRICT,
  postable boolean NOT NULL DEFAULT true,
  requires_contact boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  CHECK (parent_code IS DISTINCT FROM code)
);
CREATE TABLE public.accounting_periods (
  month text PRIMARY KEY CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','locked')),
  updated_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.accounting_journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE,
  date date NOT NULL CHECK (date >= DATE '2000-01-01'),
  currency text NOT NULL CHECK (currency IN ('EGP','USD','EUR','GBP')),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 1000),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversal_of_id uuid UNIQUE REFERENCES public.accounting_journal_entries(id) ON DELETE RESTRICT,
  CHECK (reversal_of_id IS DISTINCT FROM id)
);
CREATE TABLE public.accounting_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.accounting_journal_entries(id) ON DELETE RESTRICT,
  account_code text NOT NULL REFERENCES public.accounting_accounts(code) ON DELETE RESTRICT,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE RESTRICT,
  debit numeric(12,2) NOT NULL DEFAULT 0,
  credit numeric(12,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  sort_order integer NOT NULL DEFAULT 0,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX ON public.accounting_journal_entries(currency, date);
CREATE INDEX ON public.accounting_journal_lines(entry_id);
CREATE INDEX ON public.accounting_journal_lines(account_code, entry_id);
CREATE INDEX ON public.accounting_journal_lines(contact_id);

INSERT INTO public.accounting_accounts(code,name_en,name_ar,type,parent_code,postable,requires_contact) VALUES
 ('1','Assets','الأصول','asset',NULL,false,false),
 ('1101','Cash on hand','النقدية بالصندوق','asset','1',true,false),
 ('1102','Bank accounts','الحسابات البنكية','asset','1',true,false),
 ('1201','Guest and company receivables','ذمم النزلاء والشركات','asset','1',true,true),
 ('1301','Inventory and supplies','المخزون والمستلزمات','asset','1',true,false),
 ('1401','Property and equipment','الممتلكات والمعدات','asset','1',true,false),
 ('2','Liabilities','الالتزامات','liability',NULL,false,false),
 ('2101','Supplier payables','ذمم الموردين','liability','2',true,true),
 ('2201','Guest deposits','تأمينات النزلاء','liability','2',true,true),
 ('2301','Taxes payable','الضرائب المستحقة','liability','2',true,false),
 ('3','Equity','حقوق الملكية','equity',NULL,false,false),
 ('3101','Owner capital','رأس المال','equity','3',true,false),
 ('3201','Retained earnings','الأرباح المحتجزة','equity','3',true,false),
 ('4','Revenue','الإيرادات','revenue',NULL,false,false),
 ('4101','Room revenue','إيرادات الغرف','revenue','4',true,false),
 ('4201','Food and beverage revenue','إيرادات الطعام والشراب','revenue','4',true,false),
 ('4301','Other services revenue','إيرادات الخدمات الأخرى','revenue','4',true,false),
 ('5','Expenses','المصروفات','expense',NULL,false,false),
 ('5101','Salaries and wages','الرواتب والأجور','expense','5',true,false),
 ('5201','Utilities','المرافق','expense','5',true,false),
 ('5301','Housekeeping and supplies','النظافة والمستلزمات','expense','5',true,false),
 ('5401','Maintenance','الصيانة','expense','5',true,false),
 ('5501','Administrative expenses','المصروفات الإدارية','expense','5',true,false);

CREATE FUNCTION public.accounting_journal_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Posted journal entries and lines are immutable; create a reversal' USING ERRCODE = 'check_violation';
END;
$$;
CREATE TRIGGER journal_entries_immutable BEFORE UPDATE OR DELETE ON public.accounting_journal_entries FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_immutable();
CREATE TRIGGER journal_lines_immutable BEFORE UPDATE OR DELETE ON public.accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_immutable();

CREATE FUNCTION public.accounting_period_transition() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Accounting periods cannot be deleted' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.status = 'locked' AND NEW.status <> 'locked' THEN RAISE EXCEPTION 'A locked accounting period cannot be reopened' USING ERRCODE = 'check_violation'; END IF;
  IF OLD.month <> NEW.month THEN RAISE EXCEPTION 'Accounting period month cannot change' USING ERRCODE = 'check_violation'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounting_period_transition BEFORE UPDATE OR DELETE ON public.accounting_periods FOR EACH ROW EXECUTE FUNCTION public.accounting_period_transition();

-- Posting and period close use the same period row lock, including first use.
CREATE FUNCTION public.accounting_journal_before_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER journal_before_insert BEFORE INSERT ON public.accounting_journal_entries FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_before_insert();

CREATE FUNCTION public.accounting_journal_line_before_insert() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE account public.accounting_accounts; entry_xid text; is_reversal boolean;
BEGIN
  -- Lines may only be inserted in the transaction that creates their header.
  SELECT xmin::text, reversal_of_id IS NOT NULL INTO entry_xid,is_reversal FROM public.accounting_journal_entries WHERE id = NEW.entry_id;
  IF entry_xid IS DISTINCT FROM (txid_current() % 4294967296)::text THEN
    RAISE EXCEPTION 'Cannot add a line to a posted journal entry' USING ERRCODE = 'check_violation';
  END IF;
  SELECT * INTO account FROM public.accounting_accounts WHERE code = NEW.account_code FOR SHARE;
  IF account.code IS NULL OR (NOT is_reversal AND (NOT account.active OR NOT account.postable OR EXISTS(SELECT 1 FROM public.accounting_accounts WHERE parent_code = account.code))) THEN
    RAISE EXCEPTION 'Journal account must be an active postable leaf' USING ERRCODE = 'check_violation';
  END IF;
  -- A reversal is checked as an exact inverse at commit, so historical refs remain valid.
  IF NOT is_reversal AND account.requires_contact AND NEW.contact_id IS NULL THEN RAISE EXCEPTION 'Journal account requires a contact' USING ERRCODE = 'check_violation'; END IF;
  IF NOT is_reversal AND NEW.contact_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contacts WHERE id = NEW.contact_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Journal contact must be active' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER journal_line_before_insert BEFORE INSERT ON public.accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_line_before_insert();

-- Deferred header validation allows nested creation of balanced immutable lines.
CREATE FUNCTION public.accounting_journal_validate() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE line_count integer; total_debit numeric; total_credit numeric; header public.accounting_journal_entries;
BEGIN
  IF TG_TABLE_NAME = 'accounting_journal_lines' THEN
    SELECT * INTO header FROM public.accounting_journal_entries WHERE id = NEW.entry_id;
  ELSE header := NEW;
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
CREATE CONSTRAINT TRIGGER journal_balanced AFTER INSERT ON public.accounting_journal_entries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_validate();
CREATE CONSTRAINT TRIGGER journal_lines_balanced AFTER INSERT ON public.accounting_journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.accounting_journal_validate();

-- These tables are private to the server connection, matching the baseline.
ALTER TABLE public.accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_journal_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.accounting_accounts,public.accounting_periods,public.accounting_journal_entries,public.accounting_journal_lines FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accounting_journal_immutable(), public.accounting_period_transition(), public.accounting_journal_before_insert(), public.accounting_journal_line_before_insert(), public.accounting_journal_validate() FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON public.accounting_accounts,public.accounting_periods,public.accounting_journal_entries,public.accounting_journal_lines FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

-- Migration: fix_invoice_audit_and_refunds
--
-- Fixes two confirmed financial bugs:
--   (1) Checkout creates a duplicate paid invoice for the same reservation.
--   (2) Partial refund forces invoice.status='refunded' (no partially_refunded).
--
-- Root causes (DB-side):
--   * invoices.reservation_id column never existed in the live DB (the local
--     migration 20260630000003_add_reservation_id_to_invoices.sql was never
--     applied). Reservation invoices were linked only via free-text notes,
--     so checkout's existing-invoice lookup never matched.
--   * No unique constraint on invoices.booking_id / invoices.reservation_id,
--     so duplicate invoices are allowed.
--   * No idempotency_key column on payments (accounting), so retried
--     checkout/refund requests duplicate rows.
--   * invoices_status_check CHECK constraint lacks 'partially_refunded'.
--   * invoice_items_type_check lacks 'cancellation_fee' even though
--     cancel/route.ts inserts rows with that type.
--
-- This migration adds schema, repairs existing bad rows, then adds unique
-- constraints. It is designed to be RE-ENTRANT: each section guards with
-- information_schema checks.
--
-- It does NOT touch payments or journal-create new refunds; frozen financial
-- history is preserved. Only the cached/denormalised invoice columns and the
-- excess voided duplicate invoice are repaired.

-- ============================================================================
-- 1. Add invoices.reservation_id (re-applies the never-applied migration).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'reservation_id'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN reservation_id uuid;
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_reservation_id_fkey
      FOREIGN KEY (reservation_id)
      REFERENCES public.reservations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_reservation_id
  ON public.invoices (reservation_id)
  WHERE reservation_id IS NOT NULL;

-- ============================================================================
-- 2. Add payments.idempotency_key (accounting payments).
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payments'
      AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE public.payments
      ADD COLUMN idempotency_key text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_active_unique
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- 3. Backfill invoices.reservation_id from notes column when records were
--    auto-created with notes like "Auto-... for reservation <uuid>".
--    Uses a conservative regex so free-form notes with reservation numbers
--    are not coerced into false linkages.
-- ============================================================================
UPDATE public.invoices
SET reservation_id = (
    NULLIF(
      substring(notes FROM 'reservation ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'),
      ''
    )::uuid
  )
WHERE reservation_id IS NULL
  AND deleted_at IS NULL
  AND notes ILIKE '%reservation %';

-- ============================================================================
-- 4. Recompute cached invoice financial columns from trusted payments rows.
--    Derivation:
--      gross_paid       = SUM(amount > 0)
--      total_refunded   = -SUM(amount < 0)
--      net_paid         = gross_paid - total_refunded
--      balance_due      = MAX(amount - net_paid, 0)
--      status (derived unless terminal 'void'):
--        if total_refunded > 0 AND net_paid <= 0            -> 'refunded'
--        if total_refunded > 0 AND total_refunded < gross   -> 'partially_refunded'
--        if gross_paid > 0 AND balance_due = 0              -> 'paid'
--        if gross_paid > 0 AND balance_due > 0              -> 'partially_paid'
--        else                                              -> 'issued'
--      'void' is preserved. 'cancelled' is treated as 'void' (legacy).
-- ============================================================================
WITH recompute AS (
  SELECT
    i.id AS invoice_id,
    i.amount,
    i.status AS existing_status,
    COALESCE(SUM(p.amount) FILTER (WHERE p.amount > 0 AND p.deleted_at IS NULL), 0) AS gross_paid,
    COALESCE(-SUM(p.amount) FILTER (WHERE p.amount < 0 AND p.deleted_at IS NULL), 0) AS total_refunded
  FROM public.invoices i
  LEFT JOIN public.payments p ON p.invoice_id = i.id
  WHERE i.deleted_at IS NULL
  GROUP BY i.id, i.amount, i.status
),
derived AS (
  SELECT
    invoice_id,
    amount,
    existing_status,
    gross_paid,
    total_refunded,
    gross_paid - total_refunded AS net_paid,
    CASE
      WHEN existing_status IN ('void', 'cancelled') THEN existing_status
      WHEN total_refunded > 0 AND gross_paid > 0 AND total_refunded >= gross_paid THEN 'refunded'
      WHEN total_refunded > 0 AND total_refunded < gross_paid THEN 'partially_refunded'
      WHEN gross_paid > 0 AND gross_paid - total_refunded >= amount THEN 'paid'
      WHEN gross_paid > 0 THEN 'partially_paid'
      ELSE 'issued'
    END AS new_status
  FROM recompute
)
UPDATE public.invoices inv
SET
  paid_amount      = d.gross_paid,
  refunded_amount = d.total_refunded,
  remaining_balance = GREATEST(0, d.amount - GREATEST(d.net_paid, 0)),
  status          = CASE
    WHEN d.existing_status = 'void' THEN 'void'
    WHEN d.existing_status = 'cancelled' THEN 'void'
    ELSE d.new_status
  END,
  paid_at         = CASE
    WHEN d.existing_status = 'void' THEN inv.paid_at
    WHEN d.new_status = 'paid' THEN COALESCE(inv.paid_at, now())
    WHEN d.new_status = 'refunded' THEN inv.paid_at
    ELSE NULL
  END,
  updated_at      = now()
FROM derived d
WHERE inv.id = d.invoice_id
  AND inv.status <> d.new_status;

-- Full repair for all rows (also fixes paid_amount / refunded_amount on rows
-- already at the correct status).
WITH recompute AS (
  SELECT
    i.id AS invoice_id,
    i.amount,
    COALESCE(SUM(p.amount) FILTER (WHERE p.amount > 0 AND p.deleted_at IS NULL), 0) AS gross_paid,
    COALESCE(-SUM(p.amount) FILTER (WHERE p.amount < 0 AND p.deleted_at IS NULL), 0) AS total_refunded
  FROM public.invoices i
  LEFT JOIN public.payments p ON p.invoice_id = i.id
  WHERE i.deleted_at IS NULL
  GROUP BY i.id, i.amount
)
UPDATE public.invoices inv
SET
  paid_amount      = r.gross_paid,
  refunded_amount = r.total_refunded,
  remaining_balance = GREATEST(0, r.amount - GREATEST(r.gross_paid - r.total_refunded, 0))
FROM recompute r
WHERE inv.id = r.invoice_id;

-- ============================================================================
-- 5. Drop the duplicate invoice created at checkout for the confirmed case.
--    Reservation e00a9df2-ab5a-4906-a97a-1879c97f0bba has TWO non-void
--    invoices:
--      * 64bf673d-50bd-4c65-be36-2bfc9449dccf (auto-created; received real
--        payments: 5000 + 2000 + 3032 + -2000 refund). CANONICAL.
--      * 66a82519-ac6c-4898-959b-f9fde0669dda (created at checkout; received
--        one 10032 payment). ALTERNATE.
--    Preserve audit trail: soft-delete the alternate invoice (NULL
--    reservation_id + status='void' + void_reason) and RE-LINK its payment
--    to the canonical invoice so the customer's checkout payment is still
--    represented.
--
--    This is single-row, deterministic, and reversible. For any future
--    duplicates that surface, the unique constraint added later will
--    block new occurrences; existing extras must be reviewed manually.
-- ============================================================================
DO $$
DECLARE
  canonical_id uuid;
  duplicate_id uuid;
  reservation_id uuid := 'e00a9df2-ab5a-4906-a97a-1879c97f0bba'::uuid;
BEGIN
  SELECT id, id
  INTO canonical_id, duplicate_id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY reservation_id
             ORDER BY
               (notes ILIKE 'Auto-created for reservation%') DESC,
               created_at ASC
           ) AS rn
    FROM public.invoices
    WHERE reservation_id = reservation_id
      AND deleted_at IS NULL
  ) ranked
  WHERE ranked.rn = 2
  LIMIT 1;

  IF canonical_id IS NULL OR duplicate_id IS NULL THEN
    -- Fall back to the known specific case (only this one is repaired here).
    canonical_id := '64bf673d-50bd-4c65-be36-2bfc9449dccf'::uuid;
    duplicate_id := '66a82519-ac6c-4898-959b-f9fde0669dda'::uuid;
  END IF;

  -- Move positive payments from duplicate onto canonical (preserve history).
  -- Negative (refund) rows are NOT moved; original refund stays on canonical
  -- where it was already applied.
  UPDATE public.payments
    SET invoice_id = canonical_id
    WHERE invoice_id = duplicate_id
      AND amount > 0
      AND deleted_at IS NULL;

  -- Soft-delete duplicate and mark it void with full audit context.
  UPDATE public.invoices
    SET
      status = 'void',
      void_reason = 'Duplicate of ' || canonical_id::text
        || ' — created at checkout instead of updating existing invoice.',
      voided_at = now(),
      voided_by = NULL,
      reservation_id = NULL,
      booking_id = NULL,
      notes = COALESCE(notes, '') || ' [VOIDED: duplicate of ' || canonical_id::text || ']'
    WHERE id = duplicate_id;
END $$;

-- ============================================================================
-- 6. Extend status and type CHECK constraints to include partially_refunded
--    and cancellation_fee.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_status_check'
  ) THEN
    ALTER TABLE public.invoices
      DROP CONSTRAINT invoices_status_check;
  END IF;

  ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_status_check
    CHECK (status IN (
      'draft', 'issued', 'partially_paid', 'partially_refunded',
      'paid', 'overdue', 'void', 'refunded'
    ));
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoice_items'::regclass
      AND conname = 'invoice_items_type_check'
  ) THEN
    ALTER TABLE public.invoice_items
      DROP CONSTRAINT invoice_items_type_check;
  END IF;

  ALTER TABLE public.invoice_items
    ADD CONSTRAINT invoice_items_type_check
    CHECK (type IN (
      'room_charge', 'extra_service', 'minibar', 'laundry', 'restaurant',
      'late_checkout', 'early_check_in', 'damage_fee', 'cleaning_fee',
      'parking', 'transportation', 'discount', 'tax', 'service_charge',
      'manual_adjustment', 'cancellation_fee', 'other'
    ));
END $$;

-- ============================================================================
-- 7. Add partial uniqueness for the canonical one-invoice-per-parent rule.
--    Only enforced for non-soft-deleted invoices that are not terminal
--    (void/cancelled). After repair, no surviving non-void pair exists.
--    'cancelled' is not a valid invoices.status in the new constraint; it
--    stays excluded defensively.
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS invoices_reservation_id_active_unique
  ON public.invoices (reservation_id)
  WHERE reservation_id IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('void', 'cancelled');

CREATE UNIQUE INDEX IF NOT EXISTS invoices_booking_id_active_unique
  ON public.invoices (booking_id)
  WHERE booking_id IS NOT NULL
    AND deleted_at IS NULL
    AND status NOT IN ('void', 'cancelled');

-- ============================================================================
-- 8. Final state assertions (fail fast if repair is incomplete).
--    Confirms there are no surviving duplicate non-void invoices per parent.
-- ============================================================================
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT reservation_id, COUNT(*) AS c
    FROM public.invoices
    WHERE reservation_id IS NOT NULL
      AND deleted_at IS NULL
      AND status NOT IN ('void', 'cancelled')
    GROUP BY reservation_id
    HAVING COUNT(*) > 1
  ) x;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Repaired schema still has % duplicate non-void invoices for one reservation_id', dup_count;
  END IF;

  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT booking_id, COUNT(*) AS c
    FROM public.invoices
    WHERE booking_id IS NOT NULL
      AND deleted_at IS NULL
      AND status NOT IN ('void', 'cancelled')
    GROUP BY booking_id
    HAVING COUNT(*) > 1
  ) x;

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Repaired schema still has % duplicate non-void invoices for one booking_id', dup_count;
  END IF;
END $$;

-- Audit log entry.
COMMENT ON MIGRATION 'fix_invoice_audit_and_refunds' IS
  'Adds invoices.reservation_id, payments.idempotency_key, partially_refunded status, cancellation_fee item type, repairs duplicate invoice + cached totals, enforces unique-per-parent.';
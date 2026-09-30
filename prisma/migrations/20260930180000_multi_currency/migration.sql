-- Multi-currency without FX: every money row carries its own ISO currency and is
-- shown in it. Rates are priced per currency, a reservation only uses rates in its
-- currency, and a payment is always in its invoice's currency.

-- 1. Canonical currency codes everywhere (keep in sync with src/shared/static/currencies.ts).
ALTER TABLE public.reservations ADD CONSTRAINT reservations_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));
ALTER TABLE public.reservation_pricing_items ADD CONSTRAINT reservation_pricing_items_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));
ALTER TABLE public.invoices ADD CONSTRAINT invoices_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));
ALTER TABLE public.accounting_ledger_entries ADD CONSTRAINT accounting_ledger_entries_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));
ALTER TABLE public.room_type_pricing ADD CONSTRAINT room_type_pricing_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));
ALTER TABLE public.seasonal_rates ADD CONSTRAINT seasonal_rates_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));
ALTER TABLE public.company_price_overrides ADD CONSTRAINT company_price_overrides_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));

ALTER TABLE public.room_specific_rates ADD COLUMN currency text NOT NULL DEFAULT 'EGP'
  CONSTRAINT room_specific_rates_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));

-- 2. Payments: same currency as their invoice, enforced here (the app also checks).
ALTER TABLE public.payments ADD COLUMN currency text
  CONSTRAINT payments_currency_check CHECK (currency IN ('EGP', 'USD', 'EUR', 'GBP'));
UPDATE public.payments p SET currency = i.currency FROM public.invoices i WHERE i.id = p.invoice_id;
ALTER TABLE public.payments ALTER COLUMN currency SET NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_payments_currency_matches_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_invoice_currency text;
begin
  select currency into v_invoice_currency from public.invoices where id = new.invoice_id;
  if new.currency is distinct from v_invoice_currency then
    raise exception 'Payment currency % does not match invoice currency %', new.currency, v_invoice_currency
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

CREATE TRIGGER payments_currency_matches_invoice BEFORE INSERT OR UPDATE OF currency, invoice_id ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_payments_currency_matches_invoice();

-- An invoice cannot change currency once money was recorded against it.
CREATE OR REPLACE FUNCTION public.trg_invoices_currency_locked()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.currency is distinct from old.currency
     and exists (select 1 from public.payments p where p.invoice_id = new.id and p.deleted_at is null) then
    raise exception 'Invoice currency cannot change after payments were recorded'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

CREATE TRIGGER invoices_currency_locked BEFORE UPDATE OF currency ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_invoices_currency_locked();

-- 3. Rate uniqueness is per currency.
ALTER TABLE public.company_price_overrides DROP CONSTRAINT company_price_overrides_unique_override,
  ADD CONSTRAINT company_price_overrides_unique_override UNIQUE (contact_id, room_category, occupancy_code, currency);

DROP INDEX public.room_type_pricing_current_active_unique;
CREATE UNIQUE INDEX room_type_pricing_current_active_unique ON public.room_type_pricing USING btree (room_type_id, currency)
  WHERE ((effective_until IS NULL) AND (deleted_at IS NULL));

ALTER TABLE public.room_type_pricing DROP CONSTRAINT room_type_pricing_no_overlap;
ALTER TABLE public.room_type_pricing ADD CONSTRAINT room_type_pricing_no_overlap EXCLUDE USING gist (
  room_type_id WITH =,
  currency WITH =,
  tstzrange(COALESCE(effective_from, '-infinity'::timestamptz), COALESCE(effective_until, 'infinity'::timestamptz), '[)') WITH &&
) WHERE (deleted_at IS NULL);

-- 4. Rate resolution takes the currency; candidates in other currencies are ignored.
DROP FUNCTION public.get_room_availability(date, date, uuid, integer, uuid, uuid);
DROP FUNCTION public.create_reservation_with_rooms(date, date, jsonb, uuid, text, uuid, uuid);
DROP FUNCTION public.resolve_room_rate(uuid, date, date, uuid, occupancy_code);

CREATE OR REPLACE FUNCTION public.resolve_room_rate(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_contact_id uuid DEFAULT NULL,
  p_occupancy occupancy_code DEFAULT NULL,
  p_currency text DEFAULT 'EGP'
)
 RETURNS TABLE(rate numeric, source price_source)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with rm as (
    select r.id, r.room_type_id, rt.slug
    from public.rooms r
    join public.room_types rt on rt.id = r.room_type_id
    where r.id = p_room_id
  ),
  -- Date-ranged rates must cover every night of the stay.
  stay as (select p_check_in as first_night, greatest(p_check_in, p_check_out - 1) as last_night),
  candidates as (
    select 1 as priority, cpo.price as rate, 'company_override'::price_source as source
    from public.company_price_overrides cpo, rm
    where p_contact_id is not null
      and cpo.contact_id = p_contact_id
      and cpo.room_category = rm.slug
      and cpo.deleted_at is null
      and cpo.currency = p_currency
      and (p_occupancy is null or cpo.occupancy_code = p_occupancy)
    union all
    select 2, rsr.override_rate, 'room_specific_rate'
    from public.room_specific_rates rsr, stay
    where rsr.room_id = p_room_id
      and rsr.currency = p_currency
      and rsr.start_date <= stay.first_night
      and rsr.end_date >= stay.last_night
    union all
    select 3, sr.override_rate, 'seasonal_rate'
    from public.seasonal_rates sr, rm, stay
    where sr.room_type_id = rm.room_type_id
      and sr.status = 'active'
      and sr.currency = p_currency
      and sr.start_date <= stay.first_night
      and sr.end_date >= stay.last_night
    union all
    -- Pricing version in effect on the check-in night (versions cannot overlap).
    select 4,
      case p_occupancy
        when 'S' then coalesce(rtp.price_single, rtp.price)
        when 'D' then coalesce(rtp.price_double, rtp.price)
        when 'T' then coalesce(rtp.price_triple, rtp.price)
        else rtp.price
      end,
      'default_room_type_rate'
    from public.room_type_pricing rtp, rm
    where rtp.room_type_id = rm.room_type_id
      and rtp.deleted_at is null
      and rtp.currency = p_currency
      and (rtp.effective_from is null or rtp.effective_from <= p_check_in)
      and (rtp.effective_until is null or rtp.effective_until > p_check_in)
    union all
    -- Stay outside every version: use the latest one rather than pricing at 0.
    select 5, latest.rate, 'default_room_type_rate'
    from (
      select
        case p_occupancy
          when 'S' then coalesce(rtp.price_single, rtp.price)
          when 'D' then coalesce(rtp.price_double, rtp.price)
          when 'T' then coalesce(rtp.price_triple, rtp.price)
          else rtp.price
        end as rate
      from public.room_type_pricing rtp, rm
      where rtp.room_type_id = rm.room_type_id
        and rtp.deleted_at is null
        and rtp.currency = p_currency
      order by rtp.effective_from desc nulls last
      limit 1
    ) latest
  )
  select c.rate, c.source
  from candidates c
  order by c.priority, c.rate
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation_with_rooms(p_check_in date, p_check_out date, p_room_type_counts jsonb, p_contact_id uuid DEFAULT NULL::uuid, p_guest_name text DEFAULT ''::text, p_guest_id uuid DEFAULT NULL::uuid, p_created_by uuid DEFAULT NULL::uuid, p_currency text DEFAULT 'EGP')
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_reservation_id uuid;
  v_selected_rooms jsonb := '[]'::jsonb;
  v_room_record record;
  v_requested jsonb;
  v_room_type_id uuid;
  v_count int;
  v_occupancy_code text;
  v_got int;
  v_insufficient jsonb := '[]'::jsonb;
  v_nights int;
  v_total_amount numeric(12,2) := 0;
  v_created_reservation_room_id uuid;
  v_primary_reservation_room_id uuid;
  v_current_room_status public.room_status;
  v_contact_type text;
  v_company_id uuid;
  v_override_applied boolean := false;
  v_effective_price numeric(10,2);
  v_has_override boolean;
  v_rate_source price_source;
begin
  if p_check_in >= p_check_out then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'check_in must be before check_out')
    );
  end if;

  if p_room_type_counts is null or jsonb_array_length(p_room_type_counts) = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'At least one room type is required')
    );
  end if;

  v_nights := p_check_out - p_check_in;

  if p_contact_id is not null then
    select c.type into v_contact_type
    from public.contacts c
    where c.id = p_contact_id and c.deleted_at is null;

    if v_contact_type = 'company' then
      v_company_id := p_contact_id;
    end if;
  end if;

  for v_requested in
    select value
    from jsonb_array_elements(p_room_type_counts) as counts(value)
    order by value->>'roomTypeId'
  loop
    v_room_type_id := (v_requested->>'roomTypeId')::uuid;
    v_count := (v_requested->>'count')::int;
    v_occupancy_code := v_requested->>'occupancyCode';

    if v_count < 0 then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Room count must be non-negative')
      );
    end if;

    if v_count = 0 then continue; end if;

    perform pg_advisory_xact_lock(hashtextextended('reservation-room-type:' || v_room_type_id::text, 0));

    v_got := 0;
    for v_room_record in
      select rm.id, rm.number, rt.slug as room_type_slug
      from public.rooms rm
      join public.room_types rt on rt.id = rm.room_type_id
      where rm.room_type_id = v_room_type_id
        and rm.operational_status = 'active'
        and rm.deleted_at is null
        and not exists (
          select 1
          from public.reservation_rooms rr
          join public.reservations r on r.id = rr.reservation_id
          where rr.room_id = rm.id
            and rr.status::text not in ('cancelled', 'released')
            and r.status::text not in ('cancelled', 'expired', 'no_show', 'checked_out')
            and r.deleted_at is null
            and r.check_in_date < p_check_out
            and r.check_out_date > p_check_in
        )
        and not exists (
          select 1
          from public.reservation_holds rh
          where rh.room_id = rm.id
            and rh.status = 'active'
            and rh.expires_at > now()
            and rh.check_in_date < p_check_out
            and rh.check_out_date > p_check_in
        )
        and not exists (
          select 1
          from jsonb_array_elements(v_selected_rooms) vsel
          where (vsel->>'roomId')::uuid = rm.id
        )
      order by rm.number
      limit v_count
    loop
      -- Single rate hierarchy shared with get_room_availability / pricingService.
      select rr.rate, rr.source into v_effective_price, v_rate_source
      from public.resolve_room_rate(v_room_record.id, p_check_in, p_check_out, v_company_id, v_occupancy_code::occupancy_code, p_currency) rr;
      v_effective_price := coalesce(v_effective_price, 0);
      v_has_override := v_rate_source = 'company_override';
      if v_has_override then
        v_override_applied := true;
      end if;

      v_selected_rooms := v_selected_rooms || jsonb_build_object(
        'roomId', v_room_record.id,
        'roomNumber', v_room_record.number,
        'roomTypeId', v_room_type_id,
        'occupancyCode', v_occupancy_code,
        'nightlyRate', v_effective_price,
        'priceSource', coalesce(v_rate_source, 'default_room_type_rate')
      );
      v_got := v_got + 1;
      v_total_amount := v_total_amount + (v_effective_price * v_nights);
    end loop;

    if v_got < v_count then
      v_insufficient := v_insufficient || jsonb_build_object(
        'roomTypeId', v_room_type_id,
        'requested', v_count,
        'got', v_got
      );
    end if;
  end loop;

  if jsonb_array_length(v_insufficient) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'ROOM_UNAVAILABLE',
        'message', 'Some room types do not have enough available rooms for the requested dates',
        'details', jsonb_build_object('availability', v_insufficient)
      )
    );
  end if;

  insert into public.reservations (
    status, booking_type, source, currency,
    check_in_date, check_out_date, nights, total_amount, paid_amount,
    balance_amount, room_count, created_by, company_id, booker_name
  ) values (
    'draft'::reservation_status,
    'individual'::reservation_booking_type,
    'manual'::reservation_source,
    p_currency,
    p_check_in, p_check_out, v_nights, v_total_amount, 0,
    v_total_amount, jsonb_array_length(v_selected_rooms), p_created_by,
    v_company_id, p_guest_name
  )
  returning id into v_reservation_id;

  for v_room_record in select * from jsonb_array_elements(v_selected_rooms)
  loop
    insert into public.reservation_rooms (
      reservation_id, room_id, room_type_id,
      status, rate_per_night, nights, total_amount,
      check_in_date, check_out_date, occupancy_code, price_source
    ) values (
      v_reservation_id,
      (v_room_record.value->>'roomId')::uuid,
      (v_room_record.value->>'roomTypeId')::uuid,
      'reserved'::reservation_room_status,
      (v_room_record.value->>'nightlyRate')::numeric,
      v_nights, (v_room_record.value->>'nightlyRate')::numeric * v_nights,
      p_check_in, p_check_out,
      (v_room_record.value->>'occupancyCode')::occupancy_code,
      (v_room_record.value->>'priceSource')::price_source
    )
    returning id into v_created_reservation_room_id;

    v_current_room_status := (select status from public.rooms where id = (v_room_record.value->>'roomId')::uuid);
    insert into public.room_status_history (
      room_id, from_status, to_status, reason, reservation_id, changed_by, changed_at, metadata
    ) values (
      (v_room_record.value->>'roomId')::uuid,
      v_current_room_status,
      v_current_room_status,
      'Reservation created',
      v_reservation_id, p_created_by, now(), '{}'::jsonb
    );

    if v_primary_reservation_room_id is null then
      v_primary_reservation_room_id := v_created_reservation_room_id;
    end if;
  end loop;

  insert into public.reservation_status_history (
    reservation_id, from_status, to_status, changed_by, changed_at
  ) values (
    v_reservation_id, null, 'draft', p_created_by, now()
  );

  if p_guest_name != '' then
    insert into public.reservation_guests (
      reservation_id, reservation_room_id, role, full_name,
      is_primary, is_vip, guest_id, contact_id, created_at, updated_at
    ) values (
      v_reservation_id, v_primary_reservation_room_id,
      'primary_guest'::reservation_guest_role,
      p_guest_name, true, false,
      p_guest_id, p_contact_id, now(), now()
    );
  end if;

  if v_company_id is not null then
    insert into public.reservation_company_info (
      reservation_id, company_id, company_name, contact_person_name, payment_terms,
      credit_approved, company_pays, company_price_override_applied, created_at, updated_at
    ) values (
      v_reservation_id, v_company_id, p_guest_name, p_guest_name, 'due_on_invoice',
      false, 'company'::text, v_override_applied, now(), now()
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'reservationId', v_reservation_id,
      'rooms', v_selected_rooms
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_room_availability(p_check_in date, p_check_out date, p_room_type_id uuid DEFAULT NULL::uuid, p_capacity integer DEFAULT NULL::integer, p_contact_id uuid DEFAULT NULL::uuid, p_exclude_reservation_id uuid DEFAULT NULL::uuid, p_currency text DEFAULT 'EGP')
 RETURNS TABLE(room_id uuid, room_number text, floor integer, room_type_id uuid, room_type_name text, capacity integer, amenities jsonb, status text, reason text, base_price numeric, effective_price numeric, price_source text, currency text, price_single numeric, price_double numeric, price_triple numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with booked_room_ids as (
    select distinct rr.room_id
    from public.reservation_rooms rr
    join public.reservations r on r.id = rr.reservation_id
    where rr.room_id is not null
      and rr.status != 'cancelled'
      and r.status not in ('cancelled', 'expired', 'checked_out')
      and r.deleted_at is null
      and (p_exclude_reservation_id is null or r.id != p_exclude_reservation_id)
      and r.check_in_date < p_check_out
      and r.check_out_date > p_check_in
  ),
  held_room_ids as (
    select distinct rh.room_id
    from public.reservation_holds rh
    where rh.room_id is not null
      and rh.status not in ('released', 'expired')
      and rh.expires_at > now()
      and rh.check_in_date < p_check_out
      and rh.check_out_date > p_check_in
      and (p_exclude_reservation_id is null or rh.reservation_id != p_exclude_reservation_id)
  )
  select
    rm.id,
    rm.number,
    rm.floor,
    rt.id,
    rt.name,
    rm.capacity,
    rm.amenities,
    case
      when rm.operational_status <> 'active'
        or exists (select 1 from booked_room_ids b where b.room_id = rm.id)
        or exists (select 1 from held_room_ids h where h.room_id = rm.id)
      then 'unavailable'
      else 'available'
    end::text,
    case
      when rm.operational_status <> 'active' then rm.operational_status::text
      when rm.housekeeping_status in ('dirty', 'cleaning') then rm.housekeeping_status::text
      when exists (select 1 from booked_room_ids b where b.room_id = rm.id) then 'booked'
      when exists (select 1 from held_room_ids h where h.room_id = rm.id) then 'held'
      else null
    end::text,
    base.rate,
    coalesce(eff.rate, 0),
    coalesce(eff.source, 'default_room_type_rate')::text,
    p_currency,
    (select r.rate from public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, 'S', p_currency) r),
    (select r.rate from public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, 'D', p_currency) r),
    (select r.rate from public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, 'T', p_currency) r)
  from public.rooms rm
  join public.room_types rt on rt.id = rm.room_type_id
  left join lateral public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, NULL, p_currency) eff on true
  left join lateral public.resolve_room_rate(rm.id, p_check_in, p_check_out, NULL, NULL, p_currency) base on true
  where rm.deleted_at is null
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and (p_capacity is null or rm.capacity >= p_capacity)
  order by rm.number;
$function$;

-- Schema review cleanup: typed statuses, payment method naming, unused enums,
-- consistent currency default.

-- Unused since reservation_payments was dropped.
DROP TYPE public.reservation_payment_method;
DROP TYPE public.reservation_payment_type;

-- payments.type holds how the money was paid, i.e. a payment method.
ALTER TYPE public.payment_type RENAME TO payment_method;

-- invoices.status: text + CHECK -> enum. The old 'pending' default violated the
-- CHECK, and the partial unique index referenced a 'cancelled' status that the
-- CHECK never allowed.
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'partially_paid', 'partially_refunded', 'paid', 'overdue', 'void', 'refunded');
DROP INDEX public.invoices_reservation_id_active_unique;
ALTER TABLE public.invoices DROP CONSTRAINT invoices_status_check;
ALTER TABLE public.invoices ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.invoices ALTER COLUMN status TYPE public.invoice_status USING status::public.invoice_status;
ALTER TABLE public.invoices ALTER COLUMN status SET DEFAULT 'draft';
CREATE UNIQUE INDEX invoices_reservation_id_active_unique ON public.invoices USING btree (reservation_id)
  WHERE ((reservation_id IS NOT NULL) AND (deleted_at IS NULL) AND (status <> 'void'::public.invoice_status));

-- room_status_history follows the rooms.status state machine. Legacy rows used a
-- 'reserved' pseudo-status that rooms never had; map it to 'available'.
ALTER TABLE public.room_status_history
  ALTER COLUMN from_status TYPE public.room_status
    USING (CASE WHEN from_status = 'reserved' THEN 'available' ELSE from_status END)::public.room_status,
  ALTER COLUMN to_status TYPE public.room_status
    USING (CASE WHEN to_status = 'reserved' THEN 'available' ELSE to_status END)::public.room_status;

-- One default currency everywhere (invoices and accounting already used EGP).
ALTER TABLE public.company_price_overrides ALTER COLUMN currency SET DEFAULT 'EGP';
ALTER TABLE public.reservation_pricing_items ALTER COLUMN currency SET DEFAULT 'EGP';
ALTER TABLE public.reservations ALTER COLUMN currency SET DEFAULT 'EGP';
ALTER TABLE public.room_type_pricing ALTER COLUMN currency SET DEFAULT 'EGP';
ALTER TABLE public.seasonal_rates ALTER COLUMN currency SET DEFAULT 'EGP';

-- Functions that write room_status_history now pass room_status values.
-- auto_clean_dirty_rooms also read a non-existent r.old_status and took the
-- post-update status from RETURNING; capture the old status first.
CREATE OR REPLACE FUNCTION public.auto_clean_dirty_rooms()
 RETURNS TABLE(room_id uuid, old_status text, new_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  r record;
  sys_user uuid;
begin
  select id into sys_user from public.profiles order by created_at asc limit 1;

  for r in
    with stale as (
      select rm.id, rm.status as old_status
      from public.rooms rm
      where rm.housekeeping_status in ('dirty', 'cleaning')
        and rm.updated_at <= now() - interval '2 hours'
      for update
    )
    update public.rooms rm
    set housekeeping_status = 'clean', updated_at = now()
    from stale
    where rm.id = stale.id
    returning rm.id, stale.old_status
  loop
    insert into public.room_status_history (room_id, from_status, to_status, reason, changed_by, metadata)
    select r.id, r.old_status, rm.status, 'Auto-cleaned after 2-hour timer', sys_user, '{}'::jsonb
    from public.rooms rm where rm.id = r.id;

    room_id := r.id;
    old_status := r.old_status::text;
    new_status := (select rm.status::text from public.rooms rm where rm.id = r.id);
    return next;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_reservation_with_rooms(p_check_in date, p_check_out date, p_room_type_counts jsonb, p_contact_id uuid DEFAULT NULL::uuid, p_guest_name text DEFAULT ''::text, p_guest_id uuid DEFAULT NULL::uuid, p_created_by uuid DEFAULT NULL::uuid)
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
      from public.resolve_room_rate(v_room_record.id, p_check_in, p_check_out, v_company_id, v_occupancy_code::occupancy_code) rr;
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
    'EGP',
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


-- payments.type -> payments.method (the column holds a payment method).
ALTER TABLE public.payments RENAME COLUMN type TO method;

-- invoices.payment_method: display snapshot of the chosen method; typed like payments.method.
ALTER TABLE public.invoices ALTER COLUMN payment_method TYPE public.payment_method USING payment_method::public.payment_method;

-- Financial history must be voided / soft-deleted, never removed by a parent delete.
ALTER TABLE public.payments DROP CONSTRAINT payments_invoice_id_fkey,
  ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;
ALTER TABLE public.invoice_events DROP CONSTRAINT invoice_events_invoice_id_fkey,
  ADD CONSTRAINT invoice_events_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;
ALTER TABLE public.invoices DROP CONSTRAINT invoices_contact_id_fkey,
  ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;

-- Money precision: no unbounded numerics.
ALTER TABLE public.payments ALTER COLUMN amount TYPE numeric(12, 2);
ALTER TABLE public.expenses ALTER COLUMN amount TYPE numeric(12, 2);
ALTER TABLE public.room_type_pricing
  ALTER COLUMN price_single TYPE numeric(10, 2),
  ALTER COLUMN price_double TYPE numeric(10, 2),
  ALTER COLUMN price_triple TYPE numeric(10, 2);

-- Versioned room-type pricing: live rows of one room type may not overlap in time.
ALTER TABLE public.room_type_pricing ADD CONSTRAINT room_type_pricing_no_overlap EXCLUDE USING gist (
  room_type_id WITH =,
  tstzrange(COALESCE(effective_from, '-infinity'::timestamptz), COALESCE(effective_until, 'infinity'::timestamptz), '[)') WITH &&
) WHERE (deleted_at IS NULL);

-- Duplicate of payments_idempotency_key_active_unique (the one Prisma declares), but
-- stricter: it also blocked reusing a key after the payment was soft-deleted.
DROP INDEX public.payments_idempotency_key_idx;

-- ---------------------------------------------------------------------------
-- Room state split: occupancy, housekeeping and operational state are stored
-- separately. rooms.status stays as a derived summary (maintained by trigger)
-- so existing readers keep working; a write to status alone is translated into
-- the equivalent three-part state. Booking availability uses operational_status
-- plus reservations/holds, never the summary.
-- ---------------------------------------------------------------------------
CREATE TYPE public.room_occupancy_status AS ENUM ('vacant', 'occupied');
CREATE TYPE public.housekeeping_status AS ENUM ('clean', 'dirty', 'cleaning', 'inspected');
CREATE TYPE public.room_operational_status AS ENUM ('active', 'maintenance', 'out_of_order', 'blocked');

ALTER TABLE public.rooms
  ADD COLUMN occupancy_status public.room_occupancy_status NOT NULL DEFAULT 'vacant',
  ADD COLUMN housekeeping_status public.housekeeping_status NOT NULL DEFAULT 'clean',
  ADD COLUMN operational_status public.room_operational_status NOT NULL DEFAULT 'active';

UPDATE public.rooms SET
  occupancy_status = CASE WHEN status = 'occupied' THEN 'occupied' ELSE 'vacant' END::public.room_occupancy_status,
  housekeeping_status = CASE status WHEN 'dirty' THEN 'dirty' WHEN 'cleaning' THEN 'cleaning' ELSE 'clean' END::public.housekeeping_status,
  operational_status = CASE WHEN status = 'maintenance' THEN 'maintenance' ELSE 'active' END::public.room_operational_status;

CREATE OR REPLACE FUNCTION public.derive_room_status(
  p_occupancy public.room_occupancy_status,
  p_housekeeping public.housekeeping_status,
  p_operational public.room_operational_status
)
 RETURNS public.room_status
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_operational <> 'active' then 'maintenance'
    when p_occupancy = 'occupied' then 'occupied'
    when p_housekeeping = 'dirty' then 'dirty'
    when p_housekeeping = 'cleaning' then 'cleaning'
    else 'available'
  end::public.room_status;
$function$;

CREATE OR REPLACE FUNCTION public.trg_rooms_sync_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  -- Legacy single-status write (status changed, parts untouched): translate it.
  if (tg_op = 'INSERT' and new.status <> 'available')
     or (tg_op = 'UPDATE'
         and new.status is distinct from old.status
         and (new.occupancy_status, new.housekeeping_status, new.operational_status)
             is not distinct from (old.occupancy_status, old.housekeeping_status, old.operational_status)) then
    case new.status
      when 'available' then
        new.occupancy_status := 'vacant'; new.housekeeping_status := 'clean'; new.operational_status := 'active';
      when 'occupied' then
        new.occupancy_status := 'occupied'; new.operational_status := 'active';
      when 'dirty' then
        new.occupancy_status := 'vacant'; new.housekeeping_status := 'dirty'; new.operational_status := 'active';
      when 'cleaning' then
        new.occupancy_status := 'vacant'; new.housekeeping_status := 'cleaning'; new.operational_status := 'active';
      when 'maintenance' then
        new.operational_status := 'maintenance';
    end case;
  end if;

  new.status := public.derive_room_status(new.occupancy_status, new.housekeeping_status, new.operational_status);
  return new;
end;
$function$;

CREATE TRIGGER rooms_sync_status BEFORE INSERT OR UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.trg_rooms_sync_status();

CREATE INDEX rooms_operational_status_idx ON public.rooms USING btree (operational_status) WHERE (deleted_at IS NULL);

-- ---------------------------------------------------------------------------
-- One authoritative rate. room_type_pricing is the normal (versioned) rate;
-- room_types.base_price and rooms.price are removed. Resolution order, most
-- specific wins: company_price_overrides > room_specific_rates > seasonal_rates
-- > room_type_pricing. manual_override is applied by the app on top.
-- ---------------------------------------------------------------------------

-- Keep every existing price before dropping the columns.
INSERT INTO public.room_type_pricing (room_type_id, price, effective_from)
SELECT rt.id, rt.base_price, NULL
FROM public.room_types rt
WHERE NOT EXISTS (
  SELECT 1 FROM public.room_type_pricing rtp
  WHERE rtp.room_type_id = rt.id AND rtp.deleted_at IS NULL AND rtp.effective_until IS NULL
);

-- A room priced differently from its type becomes an open-ended room-specific rate.
INSERT INTO public.room_specific_rates (room_id, start_date, end_date, override_rate, reason, created_by)
SELECT rm.id, DATE '2000-01-01', DATE '9999-12-31', rm.price, 'Migrated from rooms.price',
       (SELECT id FROM public.users ORDER BY created_at LIMIT 1)
FROM public.rooms rm
JOIN public.room_type_pricing rtp
  ON rtp.room_type_id = rm.room_type_id AND rtp.deleted_at IS NULL AND rtp.effective_until IS NULL
WHERE rm.price > 0 AND rm.price <> rtp.price;

ALTER TABLE public.rooms DROP COLUMN price;
ALTER TABLE public.room_types DROP COLUMN base_price;

CREATE OR REPLACE FUNCTION public.resolve_room_rate(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_contact_id uuid DEFAULT NULL,
  p_occupancy occupancy_code DEFAULT NULL
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
      and (p_occupancy is null or cpo.occupancy_code = p_occupancy)
    union all
    select 2, rsr.override_rate, 'room_specific_rate'
    from public.room_specific_rates rsr, stay
    where rsr.room_id = p_room_id
      and rsr.start_date <= stay.first_night
      and rsr.end_date >= stay.last_night
    union all
    select 3, sr.override_rate, 'seasonal_rate'
    from public.seasonal_rates sr, rm, stay
    where sr.room_type_id = rm.room_type_id
      and sr.status = 'active'
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
      order by rtp.effective_from desc nulls last
      limit 1
    ) latest
  )
  select c.rate, c.source
  from candidates c
  order by c.priority, c.rate
  limit 1;
$function$;

-- Availability now prices through resolve_room_rate (the old version ignored the
-- company override's room category and errored when a room type had several
-- pricing rows). base_price = the rate without company pricing; effective_price includes it.
CREATE OR REPLACE FUNCTION public.get_room_availability(p_check_in date, p_check_out date, p_room_type_id uuid DEFAULT NULL::uuid, p_capacity integer DEFAULT NULL::integer, p_contact_id uuid DEFAULT NULL::uuid, p_exclude_reservation_id uuid DEFAULT NULL::uuid)
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
    'EGP',
    (select r.rate from public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, 'S') r),
    (select r.rate from public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, 'D') r),
    (select r.rate from public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, 'T') r)
  from public.rooms rm
  join public.room_types rt on rt.id = rm.room_type_id
  left join lateral public.resolve_room_rate(rm.id, p_check_in, p_check_out, p_contact_id, NULL) eff on true
  left join lateral public.resolve_room_rate(rm.id, p_check_in, p_check_out, NULL, NULL) base on true
  where rm.deleted_at is null
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and (p_capacity is null or rm.capacity >= p_capacity)
  order by rm.number;
$function$;

-- get_room_availability: expose per-occupancy prices so the change-room
-- modal can show S/D/T pricing before the room change is submitted.
-- Precedence mirrors pricingService.getEffectiveRate:
-- company override (occupancy-filtered) > seasonal occupancy price >
-- seasonal base price > room price.
DROP FUNCTION IF EXISTS public.get_room_availability(date, date, uuid, integer, uuid, uuid);
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
  ),
  unavailable_room_ids as (
    select room_id from booked_room_ids
    union
    select room_id from held_room_ids
    union
    select id from public.rooms where status = 'maintenance'
  ),
  company_rate as (
    select
      max(cpo.price) as price,
      min(cpo.price) filter (where cpo.occupancy_code = 'S') as price_single,
      min(cpo.price) filter (where cpo.occupancy_code = 'D') as price_double,
      min(cpo.price) filter (where cpo.occupancy_code = 'T') as price_triple
    from public.company_price_overrides cpo
    where cpo.contact_id = p_contact_id
      and cpo.deleted_at is null
  ),
  seasonal_rate as (
    select
      rtp.price,
      rtp.price_single,
      rtp.price_double,
      rtp.price_triple,
      rtp.room_type_id
    from public.room_type_pricing rtp
    where (rtp.effective_from is null or rtp.effective_from <= p_check_in)
      and (rtp.effective_until is null or rtp.effective_until >= p_check_out)
      and rtp.deleted_at is null
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
      when ua.room_id is not null then 'unavailable'
      else 'available'
    end::text,
    case
      when rm.status = 'maintenance' then 'maintenance'
      when rm.status = 'dirty' then 'dirty'
      when exists (select 1 from booked_room_ids b where b.room_id = rm.id) then 'booked'
      when exists (select 1 from held_room_ids h where h.room_id = rm.id) then 'held'
      else null
    end::text,
    rm.price,
    coalesce(
      (select cr.price from company_rate cr),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    ),
    case
      when exists (select 1 from company_rate) then 'company_override'
      when exists (select 1 from seasonal_rate sr where sr.room_type_id = rt.id) then 'seasonal'
      else 'standard'
    end::text,
    'EGP',
    coalesce(
      (select cr.price_single from company_rate cr),
      (select sr.price_single from seasonal_rate sr where sr.room_type_id = rt.id),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    ),
    coalesce(
      (select cr.price_double from company_rate cr),
      (select sr.price_double from seasonal_rate sr where sr.room_type_id = rt.id),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    ),
    coalesce(
      (select cr.price_triple from company_rate cr),
      (select sr.price_triple from seasonal_rate sr where sr.room_type_id = rt.id),
      (select sr.price from seasonal_rate sr where sr.room_type_id = rt.id),
      rm.price
    )
  from public.rooms rm
  join public.room_types rt on rt.id = rm.room_type_id
  left join unavailable_room_ids ua on ua.room_id = rm.id
  where rm.deleted_at is null
    and (p_room_type_id is null or rm.room_type_id = p_room_type_id)
    and (p_capacity is null or rm.capacity >= p_capacity)
  order by rm.number;
$function$;

-- Add contact_id FK to bookings for booking history on contact detail page
alter table public.bookings
  add column contact_id uuid references public.contacts(id) on delete set null;

create index bookings_contact_id_idx on public.bookings (contact_id);

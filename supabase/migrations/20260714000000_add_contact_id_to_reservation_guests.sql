-- Add contact_id column to reservation_guests so the selected contact
-- is preserved during reservation creation and available at checkout
-- (instead of creating a duplicate contact at checkout time)

alter table public.reservation_guests
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists idx_reservation_guests_contact_id on public.reservation_guests(contact_id);

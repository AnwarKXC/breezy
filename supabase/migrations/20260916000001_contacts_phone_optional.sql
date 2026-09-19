-- Make contact phone optional: only name stays required.
alter table public.contacts
  alter column phone drop not null;

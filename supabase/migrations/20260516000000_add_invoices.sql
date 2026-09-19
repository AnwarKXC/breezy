-- ============================================================
-- Migration: Add invoices table
-- Purpose: Track invoices sent to contacts (companies/individuals)
-- ============================================================

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  invoice_number text not null,
  amount numeric(10,2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  issue_date date not null default current_date,
  due_date date not null,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_invoice_number_unique unique (invoice_number),
  constraint invoices_amount_nonnegative check (amount >= 0)
);

create trigger invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

create index invoices_contact_id_idx on public.invoices (contact_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_due_date_idx on public.invoices (due_date);
create index invoices_issue_date_idx on public.invoices (issue_date desc);

alter table public.invoices enable row level security;

create or replace function private.can_read_invoices()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.current_app_role() in ('admin'::public.app_role, 'accountant'::public.app_role)
$$;

create or replace function private.can_write_invoices()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.is_admin()
$$;

create policy "invoices_select_staff"
on public.invoices
for select
to authenticated
using (private.can_read_invoices());

create policy "invoices_insert_admin"
on public.invoices
for insert
to authenticated
with check (private.can_write_invoices());

create policy "invoices_update_admin"
on public.invoices
for update
to authenticated
using (private.can_write_invoices())
with check (private.can_write_invoices());

create policy "invoices_delete_admin"
on public.invoices
for delete
to authenticated
using (private.can_write_invoices());

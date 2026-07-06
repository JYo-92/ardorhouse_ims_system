-- 004_installer_clock.sql
-- Adds the 'installer' role and a time_entries table for clock in / clock out.
-- Additive/safe: widens allowed roles and adds one new RLS-protected table.

-- 1. Allow the 'installer' role value.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'manager', 'user', 'installer'));

-- 2. Helper: the current user's role, SECURITY DEFINER to avoid RLS recursion.
create or replace function public.user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 3. time_entries — one row per clock-in; clock_out is null until they clock out.
create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  job_type   text not null default 'Staging' check (job_type in ('Staging', 'De-staging')),
  clock_in   timestamptz not null default now(),
  clock_out  timestamptz,
  created_at timestamptz default now()
);
create index if not exists time_entries_user_idx on public.time_entries(user_id);
create index if not exists time_entries_project_idx on public.time_entries(project_id);

alter table public.time_entries enable row level security;

-- Read: super admins and managers see all; everyone else only their own rows.
drop policy if exists te_select on public.time_entries;
create policy te_select on public.time_entries
  for select using (public.user_role() in ('super_admin', 'manager') or user_id = auth.uid());

-- Insert: you can only clock yourself in.
drop policy if exists te_insert on public.time_entries;
create policy te_insert on public.time_entries
  for insert with check (user_id = auth.uid());

-- Update: your own rows (to clock out); super admins can correct any.
drop policy if exists te_update on public.time_entries;
create policy te_update on public.time_entries
  for update using (user_id = auth.uid() or public.user_role() = 'super_admin')
  with check  (user_id = auth.uid() or public.user_role() = 'super_admin');

-- Delete: super admins only.
drop policy if exists te_delete on public.time_entries;
create policy te_delete on public.time_entries
  for delete using (public.user_role() = 'super_admin');

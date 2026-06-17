-- 002_user_permissions.sql
-- ADDITIVE, non-destructive: adds role-based access (profiles) and per-project
-- financial visibility (project_financials behind RLS). Legacy money columns on
-- `projects` are left in place here and dropped later in 003 once the app no
-- longer reads them. Safe to apply to production.

-- ===========================================================================
-- 1. profiles — one row per auth user, carries the role
-- ===========================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'user' check (role in ('super_admin','user')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER so policies can check "am I a super admin?" without
-- recursing into profiles' own RLS.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());

-- Only super admins may change roles / details of other users.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.is_super_admin()) with check (public.is_super_admin());

-- ===========================================================================
-- 2. Auto-create a profile (role 'user') whenever an auth user is created
-- ===========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.email), 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- 3. Backfill profiles for existing users; seed the two super admins
-- ===========================================================================
insert into public.profiles (id, email, full_name, role)
select u.id, u.email,
       coalesce(u.raw_user_meta_data->>'full_name', u.email), 'user'
from auth.users u
on conflict (id) do nothing;

update public.profiles
set role = 'super_admin', updated_at = now()
where lower(email) in ('joseph@ardorhouse.com', 'joy@ardorhouse.com');

-- ===========================================================================
-- 4. project_financials — money split out, protected row-by-row by RLS
-- ===========================================================================
create table if not exists public.project_financials (
  project_id        text primary key references public.projects(id) on delete cascade,
  invoice           numeric default 0,
  deposit           numeric default 0,
  contract_value    numeric default 0,
  labor             jsonb   default '[]'::jsonb,
  misc_lines        jsonb   default '[]'::jsonb,
  contract_owner_id uuid    references public.profiles(id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

alter table public.project_financials enable row level security;

-- Read: super admins see all; a user sees only rows they own.
drop policy if exists pf_select on public.project_financials;
create policy pf_select on public.project_financials
  for select using (public.is_super_admin() or contract_owner_id = auth.uid());

-- Create + assign owner: super admins only (matches "admin assigns from list").
drop policy if exists pf_insert on public.project_financials;
create policy pf_insert on public.project_financials
  for insert with check (public.is_super_admin());

-- Edit figures: super admins, or the assigned owner (who cannot reassign away
-- from themselves — WITH CHECK keeps owner = themselves unless they're admin).
drop policy if exists pf_update on public.project_financials;
create policy pf_update on public.project_financials
  for update using (public.is_super_admin() or contract_owner_id = auth.uid())
  with check  (public.is_super_admin() or contract_owner_id = auth.uid());

-- Delete: super admins only.
drop policy if exists pf_delete on public.project_financials;
create policy pf_delete on public.project_financials
  for delete using (public.is_super_admin());

-- ===========================================================================
-- 5. Backfill financials from existing project rows (owner left NULL — admins
--    see all regardless; assign owners later in-app). contract_value seeds
--    from invoice as a sensible starting point.
-- ===========================================================================
insert into public.project_financials
  (project_id, invoice, deposit, contract_value, labor, misc_lines)
select p.id,
       coalesce(p.invoice, 0),
       coalesce(p.deposit, 0),
       coalesce(p.invoice, 0),
       coalesce(p.labor, '[]'::jsonb),
       coalesce(p.misc_lines, '[]'::jsonb)
from public.projects p
on conflict (project_id) do nothing;

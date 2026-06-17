-- 003_manager_role.sql
-- Adds a third role, 'manager', to the profiles.role check constraint.
-- Managers get Weekly Payroll visibility; everything else matches a 'user'.
-- Additive/safe: only widens the allowed set of role values.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('super_admin', 'manager', 'user'));

-- 016_contract_value_access.sql
-- Contract value is visible to super admins and managers only. Managers see
-- just the contract value (via contract_values()), not invoice, deposit,
-- labor pay or profit. Being a project's contract owner, stager or salesperson
-- no longer reveals any money.

-- 1. Financials rows: super admins only (drops the contract-owner access).
drop policy if exists pf_select on public.project_financials;
create policy pf_select on public.project_financials
  for select using (public.is_super_admin());

drop policy if exists pf_update on public.project_financials;
create policy pf_update on public.project_financials
  for update using (public.is_super_admin())
  with check (public.is_super_admin());

-- 2. Contract value alone, for super admins and managers.
create or replace function public.contract_values()
returns table (project_id text, contract_value numeric)
language sql
stable
security definer
set search_path = public
as $$
  select f.project_id, f.contract_value
  from public.project_financials f
  where public.user_role() in ('super_admin', 'manager');
$$;

revoke execute on function public.contract_values() from public, anon;
grant execute on function public.contract_values() to authenticated;

-- 3. projects still carries money columns from before project_financials
-- (invoice, deposit, labor, misc_lines, log_cpm, stor_cpp). The app never
-- reads them, but anyone who can see a project could query them. Grant
-- column-level access to the operational columns only; RLS still decides
-- which rows.
revoke select, insert, update on public.projects from anon, authenticated;

grant select (id, name, address, bu, agent, start_date, end_date, notes, status,
              rooms, designer_id, salesperson_id, details, created_at, updated_at)
  on public.projects to authenticated;

grant insert (id, name, address, bu, agent, start_date, end_date, notes, status,
              rooms, designer_id, salesperson_id, details, updated_at)
  on public.projects to authenticated;

-- id is included because the app's upsert (PostgREST merge-duplicates) sets
-- every column it sends, the key among them.
grant update (id, name, address, bu, agent, start_date, end_date, notes, status,
              rooms, designer_id, salesperson_id, details, updated_at)
  on public.projects to authenticated;

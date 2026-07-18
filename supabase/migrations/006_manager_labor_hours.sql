-- 006_manager_labor_hours.sql
-- Lets Managers add/edit a project's LABOR (name, hours, pay rate) without
-- exposing project revenue. Labor lives in project_financials.labor (which is
-- otherwise admin/owner-only), so we expose just the labor column through
-- SECURITY DEFINER functions. Managers can see pay rates; they still cannot
-- read invoice / deposit / contract_value / profit.

-- Who may manage a project's labor: super admins, managers, or the owner.
create or replace function public.can_edit_labor(p_project_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.user_role() in ('super_admin', 'manager')
      or exists (
        select 1 from public.project_financials f
        where f.project_id = p_project_id and f.contract_owner_id = auth.uid()
      );
$$;

-- Read the labor list (includes pay rate).
create or replace function public.get_project_labor(p_project_id text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_edit_labor(p_project_id) then
    raise exception 'Not authorized';
  end if;
  return coalesce(
    (select labor from public.project_financials where project_id = p_project_id),
    '[]'::jsonb
  );
end $$;

-- Write the labor list. Only touches the labor column (revenue untouched).
-- Creates the financials row if the project doesn't have one yet.
create or replace function public.set_project_labor(p_project_id text, p_labor jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_labor(p_project_id) then
    raise exception 'Not authorized';
  end if;
  insert into public.project_financials (project_id, labor)
  values (p_project_id, coalesce(p_labor, '[]'::jsonb))
  on conflict (project_id) do update set labor = excluded.labor, updated_at = now();
end $$;

grant execute on function public.can_edit_labor(text) to authenticated;
grant execute on function public.get_project_labor(text) to authenticated;
grant execute on function public.set_project_labor(text, jsonb) to authenticated;

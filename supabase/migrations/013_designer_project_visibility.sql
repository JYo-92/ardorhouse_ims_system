-- 013_designer_project_visibility.sql
-- Designers (role 'user') see only the projects assigned to them. Admins and
-- managers still see everything; installers still see every project so the
-- clock-in picker works.
--
-- Assignment is a separate column from project_financials.contract_owner_id on
-- purpose: being the contract owner reveals the money, being the assigned
-- designer does not.

-- 1. Who the project belongs to.
alter table public.projects
  add column if not exists designer_id uuid references public.profiles(id) on delete set null;

create index if not exists projects_designer_idx on public.projects(designer_id);

-- 2. A project a designer creates is theirs automatically. Runs before the RLS
-- check, so the insert policy below sees the filled-in designer_id.
create or replace function public.assign_project_designer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.designer_id is null and public.user_role() = 'user' then
    new.designer_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists projects_assign_designer on public.projects;
create trigger projects_assign_designer
  before insert on public.projects
  for each row execute function public.assign_project_designer();

-- 3. Replace the old "any signed-in user" policy.
drop policy if exists proj_auth on public.projects;

drop policy if exists proj_select on public.projects;
create policy proj_select on public.projects
  for select using (
    public.user_role() in ('super_admin', 'manager', 'installer')
    or designer_id = auth.uid()
  );

-- Designers can only create projects for themselves (the trigger fills it in).
drop policy if exists proj_insert on public.projects;
create policy proj_insert on public.projects
  for insert with check (
    public.user_role() in ('super_admin', 'manager')
    or (public.user_role() = 'user' and designer_id = auth.uid())
  );

-- The with-check stops a designer handing a project to someone else.
drop policy if exists proj_update on public.projects;
create policy proj_update on public.projects
  for update using (
    public.user_role() in ('super_admin', 'manager')
    or designer_id = auth.uid()
  )
  with check (
    public.user_role() in ('super_admin', 'manager')
    or designer_id = auth.uid()
  );

drop policy if exists proj_delete on public.projects;
create policy proj_delete on public.projects
  for delete using (
    public.user_role() in ('super_admin', 'manager')
    or designer_id = auth.uid()
  );

-- 4. Inventory availability has to count furniture out on every open job,
-- including ones the viewer can't see. Exposes only item ids and quantities —
-- no names, addresses or money.
create or replace function public.staged_allocations()
returns table (project_id text, status text, rooms jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select id, status, rooms
  from public.projects
  where auth.uid() is not null
    and coalesce(status, '') <> 'Completed';
$$;

revoke execute on function public.staged_allocations() from public, anon;
grant execute on function public.staged_allocations() to authenticated;

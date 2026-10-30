-- 015_salesperson_job_details.sql
-- Each project now has a salesperson (who sold it) as well as a stager
-- responsible. The stager responsible reuses projects.designer_id from 013, so
-- project visibility for designers is unchanged; the salesperson can now see
-- the project too. Revenue reporting credits both, in separate columns.
--
-- Job types (projects.bu) gain type-specific fields, kept in projects.details
-- so a new field doesn't need a migration. No money goes in details —
-- designers can read this table.

alter table public.projects
  add column if not exists salesperson_id uuid references public.profiles(id) on delete set null,
  add column if not exists details jsonb not null default '{}'::jsonb;

create index if not exists projects_salesperson_idx on public.projects(salesperson_id);

comment on column public.projects.designer_id is 'Stager responsible. Designers see projects where they are the stager or the salesperson.';

-- Visibility: stager responsible OR salesperson.
drop policy if exists proj_select on public.projects;
create policy proj_select on public.projects
  for select using (
    public.user_role() in ('super_admin', 'manager', 'installer')
    or designer_id = auth.uid()
    or salesperson_id = auth.uid()
  );

drop policy if exists proj_update on public.projects;
create policy proj_update on public.projects
  for update using (
    public.user_role() in ('super_admin', 'manager')
    or designer_id = auth.uid()
    or salesperson_id = auth.uid()
  )
  with check (
    public.user_role() in ('super_admin', 'manager')
    or designer_id = auth.uid()
    or salesperson_id = auth.uid()
  );

drop policy if exists proj_delete on public.projects;
create policy proj_delete on public.projects
  for delete using (
    public.user_role() in ('super_admin', 'manager')
    or designer_id = auth.uid()
    or salesperson_id = auth.uid()
  );

-- Retired job type, unused so far; fold into its replacement just in case.
update public.projects set bu = 'Furnishing' where bu in ('Furniture Rental', 'Vacation Rental Design');

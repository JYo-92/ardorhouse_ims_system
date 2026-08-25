-- 011_misc_labor.sql
-- Hours not attached to a staging job: warehouse help, junk removal, delivery
-- runs. These are overhead, so they deliberately do NOT live in
-- project_financials.labor -- putting them on a fake project would distort the
-- per-project margins used to price work. They still flow into Payroll.

create table if not exists public.misc_labor (
  id          uuid primary key default gen_random_uuid(),
  worker_name text not null,
  role        text,
  work_type   text not null default 'Warehouse'
                check (work_type in ('Warehouse', 'Junk Removal', 'Delivery / Pickup', 'Other')),
  description text,
  work_date   date not null,
  start_time  text,
  end_time    text,
  hours       numeric,
  rate        numeric not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists misc_labor_date_idx on public.misc_labor(work_date);
create index if not exists misc_labor_name_idx on public.misc_labor(lower(worker_name));

alter table public.misc_labor enable row level security;

drop policy if exists ml_select on public.misc_labor;
create policy ml_select on public.misc_labor
  for select using (public.user_role() in ('super_admin', 'manager'));

drop policy if exists ml_insert on public.misc_labor;
create policy ml_insert on public.misc_labor
  for insert with check (public.user_role() in ('super_admin', 'manager'));

drop policy if exists ml_update on public.misc_labor;
create policy ml_update on public.misc_labor
  for update using (public.user_role() in ('super_admin', 'manager'))
  with check       (public.user_role() in ('super_admin', 'manager'));

drop policy if exists ml_delete on public.misc_labor;
create policy ml_delete on public.misc_labor
  for delete using (public.user_role() in ('super_admin', 'manager'));

drop trigger if exists misc_labor_touch on public.misc_labor;
create trigger misc_labor_touch before update on public.misc_labor
  for each row execute function public.touch_updated_at();

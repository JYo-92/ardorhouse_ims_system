-- 007_crm.sql
-- Adds a lightweight CRM: brokerages, contacts (real estate agents), the
-- projects we have done for each contact, notes, and tasks.
--
-- Deliberately additive and non-destructive:
--   * No existing table is altered. In particular projects.agent is left
--     completely alone — contact↔project links live in their own table so
--     linking a contact can never rewrite an operational project record.
--   * Installers get no access at all; this is for admins, managers and
--     designers only.
--
-- Email is intentionally NOT stored here. Conversations stay in Gmail.

-- ---------------------------------------------------------------------------
-- 1. Brokerages (KW, Compass, ...). Agents optionally belong to one.
-- ---------------------------------------------------------------------------
create table if not exists public.brokerages (
  id         text primary key,
  name       text not null,
  address    text,
  phone      text,
  website    text,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists brokerages_name_idx on public.brokerages(lower(name));

-- ---------------------------------------------------------------------------
-- 2. Contacts — the agents themselves.
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id           text primary key,
  first_name   text not null,
  last_name    text,
  email        text,
  phone        text,
  title        text,
  brokerage_id text references public.brokerages(id) on delete set null,
  -- Who owns the relationship. Kept as a plain reference to profiles so the
  -- owner survives even if that teammate is later removed.
  owner_id     uuid references public.profiles(id) on delete set null,
  status       text not null default 'Active'
                 check (status in ('Active', 'Prospect', 'Inactive')),
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists contacts_name_idx      on public.contacts(lower(first_name), lower(last_name));
create index if not exists contacts_brokerage_idx on public.contacts(brokerage_id);
create index if not exists contacts_owner_idx     on public.contacts(owner_id);

-- ---------------------------------------------------------------------------
-- 3. Which projects we have done for a contact.
--    A separate link table on purpose: the projects table is never touched,
--    and one project can involve more than one contact.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_projects (
  contact_id text not null references public.contacts(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (contact_id, project_id)
);
create index if not exists contact_projects_project_idx on public.contact_projects(project_id);

-- ---------------------------------------------------------------------------
-- 4. Communication notes — an append-only timeline per contact.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_notes (
  id         uuid primary key default gen_random_uuid(),
  contact_id text not null references public.contacts(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  body       text not null,
  created_at timestamptz default now()
);
create index if not exists contact_notes_contact_idx on public.contact_notes(contact_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Tasks / follow-ups.
-- ---------------------------------------------------------------------------
create table if not exists public.contact_tasks (
  id           uuid primary key default gen_random_uuid(),
  contact_id   text not null references public.contacts(id) on delete cascade,
  title        text not null,
  due_date     date,
  assigned_to  uuid references public.profiles(id) on delete set null,
  status       text not null default 'Open' check (status in ('Open', 'Done')),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz default now(),
  completed_at timestamptz
);
create index if not exists contact_tasks_contact_idx  on public.contact_tasks(contact_id);
create index if not exists contact_tasks_assignee_idx on public.contact_tasks(assigned_to, status, due_date);

-- ---------------------------------------------------------------------------
-- 6. Row level security.
--    The CRM is a shared team address book: admins, managers and designers
--    all read and write it. Installers are excluded entirely. Only super
--    admins can delete a contact or brokerage, so history is not lost by
--    accident.
-- ---------------------------------------------------------------------------
alter table public.brokerages      enable row level security;
alter table public.contacts        enable row level security;
alter table public.contact_projects enable row level security;
alter table public.contact_notes   enable row level security;
alter table public.contact_tasks   enable row level security;

-- Everything below keys off this: the CRM-enabled roles.
-- (public.user_role() is defined in 004 and is SECURITY DEFINER.)

-- Brokerages ---------------------------------------------------------------
drop policy if exists brk_select on public.brokerages;
create policy brk_select on public.brokerages
  for select using (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists brk_insert on public.brokerages;
create policy brk_insert on public.brokerages
  for insert with check (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists brk_update on public.brokerages;
create policy brk_update on public.brokerages
  for update using      (public.user_role() in ('super_admin', 'manager', 'user'))
  with check            (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists brk_delete on public.brokerages;
create policy brk_delete on public.brokerages
  for delete using (public.user_role() = 'super_admin');

-- Contacts -----------------------------------------------------------------
drop policy if exists con_select on public.contacts;
create policy con_select on public.contacts
  for select using (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists con_insert on public.contacts;
create policy con_insert on public.contacts
  for insert with check (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists con_update on public.contacts;
create policy con_update on public.contacts
  for update using      (public.user_role() in ('super_admin', 'manager', 'user'))
  with check            (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists con_delete on public.contacts;
create policy con_delete on public.contacts
  for delete using (public.user_role() = 'super_admin');

-- Contact ↔ project links ---------------------------------------------------
drop policy if exists cp_select on public.contact_projects;
create policy cp_select on public.contact_projects
  for select using (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists cp_insert on public.contact_projects;
create policy cp_insert on public.contact_projects
  for insert with check (public.user_role() in ('super_admin', 'manager', 'user'));

-- Unlinking is not destructive to the project itself, so the CRM roles may do it.
drop policy if exists cp_delete on public.contact_projects;
create policy cp_delete on public.contact_projects
  for delete using (public.user_role() in ('super_admin', 'manager', 'user'));

-- Notes ---------------------------------------------------------------------
drop policy if exists cn_select on public.contact_notes;
create policy cn_select on public.contact_notes
  for select using (public.user_role() in ('super_admin', 'manager', 'user'));

-- You can only post a note as yourself.
drop policy if exists cn_insert on public.contact_notes;
create policy cn_insert on public.contact_notes
  for insert with check (
    public.user_role() in ('super_admin', 'manager', 'user')
    and author_id = auth.uid()
  );

-- Edit or remove your own notes; super admins can clean up any.
drop policy if exists cn_update on public.contact_notes;
create policy cn_update on public.contact_notes
  for update using      (author_id = auth.uid() or public.user_role() = 'super_admin')
  with check            (author_id = auth.uid() or public.user_role() = 'super_admin');

drop policy if exists cn_delete on public.contact_notes;
create policy cn_delete on public.contact_notes
  for delete using (author_id = auth.uid() or public.user_role() = 'super_admin');

-- Tasks ---------------------------------------------------------------------
drop policy if exists ct_select on public.contact_tasks;
create policy ct_select on public.contact_tasks
  for select using (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists ct_insert on public.contact_tasks;
create policy ct_insert on public.contact_tasks
  for insert with check (public.user_role() in ('super_admin', 'manager', 'user'));

-- Anyone on the team can tick off a shared follow-up.
drop policy if exists ct_update on public.contact_tasks;
create policy ct_update on public.contact_tasks
  for update using      (public.user_role() in ('super_admin', 'manager', 'user'))
  with check            (public.user_role() in ('super_admin', 'manager', 'user'));

drop policy if exists ct_delete on public.contact_tasks;
create policy ct_delete on public.contact_tasks
  for delete using (created_by = auth.uid() or public.user_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- 7. Teammate lookup for the CRM dropdowns.
--
--    profiles' own RLS deliberately only lets you read your own row (super
--    admins excepted), so a designer cannot join to profiles to render an
--    "owner" or "assigned to" name. Rather than widen that policy — which
--    would expose every teammate's email address to everyone — expose the
--    minimum needed through a SECURITY DEFINER function: id, name and role
--    only. No email, no timestamps.
-- ---------------------------------------------------------------------------
create or replace function public.crm_team_members()
returns table (id uuid, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.role
  from public.profiles p
  where public.user_role() in ('super_admin', 'manager', 'user')
    and p.role <> 'installer'
  order by p.full_name nulls last;
$$;

revoke all on function public.crm_team_members() from public, anon;
grant execute on function public.crm_team_members() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Keep updated_at honest on the two edited-in-place tables.
-- ---------------------------------------------------------------------------
-- search_path is pinned so a caller-controlled search_path cannot influence
-- this trigger. now() is in pg_catalog, which is always in scope.
create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brokerages_touch on public.brokerages;
create trigger brokerages_touch before update on public.brokerages
  for each row execute function public.touch_updated_at();

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();

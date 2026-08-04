-- 008_crm_contact_visibility.sql
-- Narrows CRM visibility:
--   * super_admin + manager (operations) — see every contact.
--   * user (designer)                    — only contacts they created, plus
--                                          any contact assigned to them as
--                                          the contact owner.
--   * installer                          — no access (unchanged).
--
-- Enforced in the database, so it holds regardless of what the UI does.
-- Brokerages stay shared: they are companies, not relationships.

-- 1. Record who added each contact. Existing rows fall back to the assigned
--    owner so nothing already entered becomes orphaned.
alter table public.contacts
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

update public.contacts set created_by = owner_id where created_by is null;

create index if not exists contacts_created_by_idx on public.contacts(created_by);

-- 2. Helper for the child tables (notes/tasks/links). SECURITY DEFINER so it
--    can read contacts without tripping that table's own RLS.
create or replace function public.can_see_contact(p_contact_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.contacts c
    where c.id = p_contact_id
      and (
        public.user_role() in ('super_admin', 'manager')
        or c.created_by = auth.uid()
        or c.owner_id   = auth.uid()
      )
  );
$$;

revoke all on function public.can_see_contact(text) from public, anon;
grant execute on function public.can_see_contact(text) to authenticated;

-- 3. Contacts. Written inline rather than via the helper to avoid recursive
--    RLS evaluation on this table.
drop policy if exists con_select on public.contacts;
create policy con_select on public.contacts
  for select using (
    public.user_role() in ('super_admin', 'manager')
    or (public.user_role() = 'user'
        and (created_by = auth.uid() or owner_id = auth.uid()))
  );

-- Everyone in the CRM may add a contact, but it is always stamped as theirs.
drop policy if exists con_insert on public.contacts;
create policy con_insert on public.contacts
  for insert with check (
    public.user_role() in ('super_admin', 'manager', 'user')
    and created_by = auth.uid()
  );

-- Designers may only edit contacts they can see, and may not hand ownership
-- to someone else in a way that hides it from themselves by accident — the
-- with-check mirrors the using clause.
drop policy if exists con_update on public.contacts;
create policy con_update on public.contacts
  for update using (
    public.user_role() in ('super_admin', 'manager')
    or (public.user_role() = 'user'
        and (created_by = auth.uid() or owner_id = auth.uid()))
  )
  with check (
    public.user_role() in ('super_admin', 'manager')
    or (public.user_role() = 'user'
        and (created_by = auth.uid() or owner_id = auth.uid()))
  );

-- Delete stays super-admin only.
drop policy if exists con_delete on public.contacts;
create policy con_delete on public.contacts
  for delete using (public.user_role() = 'super_admin');

-- 4. Contact ↔ project links follow the contact.
drop policy if exists cp_select on public.contact_projects;
create policy cp_select on public.contact_projects
  for select using (public.can_see_contact(contact_id));

drop policy if exists cp_insert on public.contact_projects;
create policy cp_insert on public.contact_projects
  for insert with check (public.can_see_contact(contact_id));

drop policy if exists cp_delete on public.contact_projects;
create policy cp_delete on public.contact_projects
  for delete using (public.can_see_contact(contact_id));

-- 5. Notes follow the contact.
drop policy if exists cn_select on public.contact_notes;
create policy cn_select on public.contact_notes
  for select using (public.can_see_contact(contact_id));

drop policy if exists cn_insert on public.contact_notes;
create policy cn_insert on public.contact_notes
  for insert with check (
    public.can_see_contact(contact_id) and author_id = auth.uid()
  );

drop policy if exists cn_update on public.contact_notes;
create policy cn_update on public.contact_notes
  for update using (author_id = auth.uid() or public.user_role() = 'super_admin')
  with check       (author_id = auth.uid() or public.user_role() = 'super_admin');

drop policy if exists cn_delete on public.contact_notes;
create policy cn_delete on public.contact_notes
  for delete using (author_id = auth.uid() or public.user_role() = 'super_admin');

-- 6. Tasks follow the contact, but a task assigned to you stays visible even
--    if the contact itself is not yours — otherwise it would silently vanish
--    from the assignee's list.
drop policy if exists ct_select on public.contact_tasks;
create policy ct_select on public.contact_tasks
  for select using (
    public.can_see_contact(contact_id) or assigned_to = auth.uid()
  );

drop policy if exists ct_insert on public.contact_tasks;
create policy ct_insert on public.contact_tasks
  for insert with check (public.can_see_contact(contact_id));

drop policy if exists ct_update on public.contact_tasks;
create policy ct_update on public.contact_tasks
  for update using (
    public.can_see_contact(contact_id) or assigned_to = auth.uid()
  )
  with check (
    public.can_see_contact(contact_id) or assigned_to = auth.uid()
  );

drop policy if exists ct_delete on public.contact_tasks;
create policy ct_delete on public.contact_tasks
  for delete using (created_by = auth.uid() or public.user_role() = 'super_admin');

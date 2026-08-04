-- 009_task_visibility.sql
-- Tasks become personal rather than contact-wide.
--
-- Before: anyone who could see the contact could see every task on it, so a
-- designer could read a follow-up assigned to a different designer.
--
-- After:
--   * super_admin / manager (operations) — see every task, for oversight.
--   * everyone else                      — only tasks assigned to them, or
--                                          tasks they created themselves.
--
-- Creating a task still requires access to the contact it hangs off.

drop policy if exists ct_select on public.contact_tasks;
create policy ct_select on public.contact_tasks
  for select using (
    public.user_role() in ('super_admin', 'manager')
    or assigned_to = auth.uid()
    or created_by  = auth.uid()
  );

-- Ticking a task off follows the same rule as seeing it.
drop policy if exists ct_update on public.contact_tasks;
create policy ct_update on public.contact_tasks
  for update using (
    public.user_role() in ('super_admin', 'manager')
    or assigned_to = auth.uid()
    or created_by  = auth.uid()
  )
  with check (
    public.user_role() in ('super_admin', 'manager')
    or assigned_to = auth.uid()
    or created_by  = auth.uid()
  );

-- Unchanged, restated for clarity: you may only add a task to a contact you
-- have access to, and only the creator (or a super admin) may delete one.
drop policy if exists ct_insert on public.contact_tasks;
create policy ct_insert on public.contact_tasks
  for insert with check (public.can_see_contact(contact_id));

drop policy if exists ct_delete on public.contact_tasks;
create policy ct_delete on public.contact_tasks
  for delete using (created_by = auth.uid() or public.user_role() = 'super_admin');

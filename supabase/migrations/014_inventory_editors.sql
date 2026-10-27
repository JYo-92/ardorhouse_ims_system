-- 014_inventory_editors.sql
-- Inventory, its photos and categories are read-only for designers. Only super
-- admins and managers add, edit or delete them. Designers still pick furniture
-- into their projects — that writes projects.rooms, not inventory.

-- 1. Inventory items.
drop policy if exists inv_auth on public.inventory;

drop policy if exists inv_select on public.inventory;
create policy inv_select on public.inventory
  for select using (auth.role() = 'authenticated');

drop policy if exists inv_insert on public.inventory;
create policy inv_insert on public.inventory
  for insert with check (public.user_role() in ('super_admin', 'manager'));

drop policy if exists inv_update on public.inventory;
create policy inv_update on public.inventory
  for update using (public.user_role() in ('super_admin', 'manager'))
  with check       (public.user_role() in ('super_admin', 'manager'));

drop policy if exists inv_delete on public.inventory;
create policy inv_delete on public.inventory
  for delete using (public.user_role() in ('super_admin', 'manager'));

-- 2. Categories. The old policy allowed anyone, even signed-out visitors.
drop policy if exists categories_all on public.categories;

drop policy if exists cat_select on public.categories;
create policy cat_select on public.categories
  for select using (auth.role() = 'authenticated');

drop policy if exists cat_insert on public.categories;
create policy cat_insert on public.categories
  for insert with check (public.user_role() in ('super_admin', 'manager'));

drop policy if exists cat_update on public.categories;
create policy cat_update on public.categories
  for update using (public.user_role() in ('super_admin', 'manager'))
  with check       (public.user_role() in ('super_admin', 'manager'));

drop policy if exists cat_delete on public.categories;
create policy cat_delete on public.categories
  for delete using (public.user_role() in ('super_admin', 'manager'));

-- 3. Item photos. Public read stays (images are shown by URL).
drop policy if exists storage_auth_insert on storage.objects;
create policy storage_auth_insert on storage.objects
  for insert with check (
    bucket_id = 'inventory-images'
    and public.user_role() in ('super_admin', 'manager')
  );

drop policy if exists storage_auth_delete on storage.objects;
create policy storage_auth_delete on storage.objects
  for delete using (
    bucket_id = 'inventory-images'
    and public.user_role() in ('super_admin', 'manager')
  );

-- 005_invite_role.sql
-- When an invited user accepts, apply the role chosen at invite time (stored in
-- their user metadata) instead of always defaulting to 'user'. Also carry the
-- job title label. Additive/safe: only redefines the new-user trigger function.

alter table public.profiles add column if not exists job_title text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  invited_role text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, email, full_name, job_title, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'job_title',
    case when invited_role in ('super_admin', 'manager', 'user', 'installer')
         then invited_role else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

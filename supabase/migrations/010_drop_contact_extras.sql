-- 010_drop_contact_extras.sql
-- Brokerage, job title and status are no longer tracked on a contact. A
-- contact is now just: first name, last name, email, phone, owner, notes.
--
-- The columns and the brokerages table are dropped rather than left dangling,
-- so the schema matches what the app actually uses. Nothing else references
-- them: the app stopped reading and writing these before this ran.

alter table public.contacts drop column if exists brokerage_id;
alter table public.contacts drop column if exists title;
alter table public.contacts drop column if exists status;

drop table if exists public.brokerages;

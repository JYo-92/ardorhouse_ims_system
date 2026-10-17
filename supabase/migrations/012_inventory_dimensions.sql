-- 012_inventory_dimensions.sql
-- Physical dimensions for inventory, in inches.
--
-- Nullable on purpose: every existing piece starts blank and gets measured
-- over time. A 0 would be wrong — it would read as "this sofa is zero inches
-- wide" rather than "nobody has measured it yet".
--
-- The unit is in the column name so it cannot drift. Existing free-text `size`
-- (Queen, 5x7) is left alone; it labels a category of thing, which is a
-- different question from how big it actually is.

alter table public.inventory add column if not exists width_in  numeric;
alter table public.inventory add column if not exists depth_in  numeric;
alter table public.inventory add column if not exists height_in numeric;

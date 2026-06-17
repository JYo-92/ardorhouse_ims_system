-- ============================================================================
-- ardorhouse-ims — PRODUCTION schema snapshot (project ref wdyrngcknoswtuhawzgj)
-- Captured READ-ONLY via the Supabase connector on 2026-06-11.
--
-- This is a REFERENCE reconstruction from live introspection (tables, columns,
-- types, defaults, PKs, unique + RLS flags). It is NOT a substitute for a true
-- `supabase db pull` / `db dump`: RLS *policy bodies*, indexes, triggers, and
-- grants are NOT captured here. See auth-rls.sql for the policy definitions.
--
-- NOTE: the remote migration-history table is EMPTY — migrations/001_normalize_
-- schema.sql was applied to prod outside the migration system, so the CLI's
-- `db pull` reports a history mismatch until reconciled. Do not treat this file
-- as an applied migration.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.inventory  (315 rows, RLS enabled)
-- ---------------------------------------------------------------------------
CREATE TABLE public.inventory (
  id          text        NOT NULL DEFAULT (gen_random_uuid())::text,
  name        text        NOT NULL,
  category    text        NOT NULL,
  size        text,
  qty         integer     NOT NULL DEFAULT 1,
  cost        numeric     NOT NULL DEFAULT 0,
  status      text                 DEFAULT 'In Warehouse'::text,
  notes       text,
  images      jsonb                DEFAULT '[]'::jsonb,
  created_at  timestamptz          DEFAULT now(),
  updated_at  timestamptz          DEFAULT now(),
  CONSTRAINT inventory_pkey PRIMARY KEY (id)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- public.projects  (21 rows, RLS enabled)
-- ---------------------------------------------------------------------------
CREATE TABLE public.projects (
  id          text        NOT NULL DEFAULT (gen_random_uuid())::text,
  name        text        NOT NULL,
  address     text,
  bu          text        NOT NULL,
  agent       text,
  start_date  text,
  end_date    text,
  notes       text,
  invoice     numeric              DEFAULT 0,
  deposit     numeric              DEFAULT 0,
  rooms       jsonb                DEFAULT '{}'::jsonb,
  labor       jsonb                DEFAULT '[]'::jsonb,
  log_runs    integer              DEFAULT 0,
  log_miles   numeric              DEFAULT 0,
  log_cpm     numeric              DEFAULT 0.67,
  stor_pulls  integer              DEFAULT 0,
  stor_cpp    numeric              DEFAULT 0,
  misc_lines  jsonb                DEFAULT '[]'::jsonb,
  created_at  timestamptz          DEFAULT now(),
  updated_at  timestamptz          DEFAULT now(),
  status      text                 DEFAULT 'Scheduled'::text,
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- public.payroll  (1 row, RLS enabled)
-- ---------------------------------------------------------------------------
CREATE TABLE public.payroll (
  id          text        NOT NULL DEFAULT (gen_random_uuid())::text,
  week_start  text        NOT NULL,
  entries     jsonb                DEFAULT '[]'::jsonb,
  created_at  timestamptz          DEFAULT now(),
  updated_at  timestamptz          DEFAULT now(),
  CONSTRAINT payroll_pkey PRIMARY KEY (id),
  CONSTRAINT payroll_week_start_key UNIQUE (week_start)
);
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- public.categories  (20 rows, RLS enabled)
-- ---------------------------------------------------------------------------
CREATE TABLE public.categories (
  id          text        NOT NULL DEFAULT (gen_random_uuid())::text,
  name        text        NOT NULL,
  created_at  timestamptz          DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_name_key UNIQUE (name)
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Phase 0: Schema Normalization
-- Adds relational tables alongside existing JSONB columns.
-- The old HTML app continues to read JSONB; the new Next.js
-- app reads from these normalized tables.
-- ============================================================

-- 1. Project Rooms (replaces projects.rooms JSONB keys)
CREATE TABLE IF NOT EXISTS project_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, room_name)
);

-- 2. Room Assignments (replaces arrays inside rooms JSONB)
CREATE TABLE IF NOT EXISTS room_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES project_rooms(id) ON DELETE CASCADE,
  inventory_id TEXT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Project Labor (replaces projects.labor JSONB)
CREATE TABLE IF NOT EXISTS project_labor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  workers INTEGER NOT NULL DEFAULT 1,
  hours NUMERIC(6,1) NOT NULL DEFAULT 0,
  rate NUMERIC(8,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Project Misc Line Items (replaces projects.misc_lines JSONB)
CREATE TABLE IF NOT EXISTS project_misc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Payroll Entries (replaces payroll.entries JSONB)
CREATE TABLE IF NOT EXISTS payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id TEXT NOT NULL REFERENCES payroll(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Stager',
  mon NUMERIC(4,1) DEFAULT 0,
  tue NUMERIC(4,1) DEFAULT 0,
  wed NUMERIC(4,1) DEFAULT 0,
  thu NUMERIC(4,1) DEFAULT 0,
  fri NUMERIC(4,1) DEFAULT 0,
  sat NUMERIC(4,1) DEFAULT 0,
  sun NUMERIC(4,1) DEFAULT 0,
  rate NUMERIC(8,2) NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Locations (for future multi-warehouse support)
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add optional location FK to inventory (nullable for backward compat)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- ============================================================
-- Enable RLS on new tables
-- ============================================================
ALTER TABLE project_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_misc ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Authenticated-only policies (matching existing pattern)
CREATE POLICY project_rooms_auth ON project_rooms FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY room_assignments_auth ON room_assignments FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY project_labor_auth ON project_labor FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY project_misc_auth ON project_misc FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY payroll_entries_auth ON payroll_entries FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY locations_auth ON locations FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- Indexes for common queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_project_rooms_project ON project_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_room ON room_assignments(room_id);
CREATE INDEX IF NOT EXISTS idx_room_assignments_inventory ON room_assignments(inventory_id);
CREATE INDEX IF NOT EXISTS idx_project_labor_project ON project_labor(project_id);
CREATE INDEX IF NOT EXISTS idx_project_misc_project ON project_misc(project_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_payroll ON payroll_entries(payroll_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- ============================================================
-- Data Migration: JSONB → Normalized Tables
-- Run this ONCE after creating the tables.
-- ============================================================

-- Migrate projects.rooms → project_rooms + room_assignments
DO $$
DECLARE
  proj RECORD;
  room_key TEXT;
  room_items JSONB;
  new_room_id UUID;
  item JSONB;
BEGIN
  FOR proj IN SELECT id, rooms FROM projects WHERE rooms IS NOT NULL AND rooms != '{}'::jsonb LOOP
    FOR room_key, room_items IN SELECT * FROM jsonb_each(proj.rooms) LOOP
      -- Insert room
      INSERT INTO project_rooms (project_id, room_name)
      VALUES (proj.id, room_key)
      ON CONFLICT (project_id, room_name) DO NOTHING
      RETURNING id INTO new_room_id;

      -- If room already existed, get its id
      IF new_room_id IS NULL THEN
        SELECT id INTO new_room_id FROM project_rooms
        WHERE project_id = proj.id AND room_name = room_key;
      END IF;

      -- Insert room assignments
      IF jsonb_typeof(room_items) = 'array' THEN
        FOR item IN SELECT * FROM jsonb_array_elements(room_items) LOOP
          INSERT INTO room_assignments (room_id, inventory_id, qty)
          VALUES (
            new_room_id,
            item->>'itemId',
            COALESCE((item->>'qty')::integer, 1)
          )
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Migrate projects.labor → project_labor
DO $$
DECLARE
  proj RECORD;
  item JSONB;
BEGIN
  FOR proj IN SELECT id, labor FROM projects WHERE labor IS NOT NULL AND labor != '[]'::jsonb LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(proj.labor) LOOP
      INSERT INTO project_labor (project_id, role, workers, hours, rate)
      VALUES (
        proj.id,
        COALESCE(item->>'role', 'Stager'),
        COALESCE((item->>'workers')::integer, 1),
        COALESCE((item->>'hours')::numeric, 0),
        COALESCE((item->>'rate')::numeric, 0)
      );
    END LOOP;
  END LOOP;
END $$;

-- Migrate projects.misc_lines → project_misc
DO $$
DECLARE
  proj RECORD;
  item JSONB;
BEGIN
  FOR proj IN SELECT id, misc_lines FROM projects WHERE misc_lines IS NOT NULL AND misc_lines != '[]'::jsonb LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(proj.misc_lines) LOOP
      INSERT INTO project_misc (project_id, description, amount)
      VALUES (
        proj.id,
        COALESCE(item->>'desc', ''),
        COALESCE((item->>'amount')::numeric, 0)
      );
    END LOOP;
  END LOOP;
END $$;

-- Migrate payroll.entries → payroll_entries
DO $$
DECLARE
  pay RECORD;
  item JSONB;
  days JSONB;
BEGIN
  FOR pay IN SELECT id, entries FROM payroll WHERE entries IS NOT NULL AND entries != '[]'::jsonb LOOP
    FOR item IN SELECT * FROM jsonb_array_elements(pay.entries) LOOP
      days := COALESCE(item->'days', '[]'::jsonb);
      INSERT INTO payroll_entries (payroll_id, name, role, mon, tue, wed, thu, fri, sat, sun, rate)
      VALUES (
        pay.id,
        COALESCE(item->>'name', ''),
        COALESCE(item->>'role', 'Stager'),
        COALESCE((days->>0)::numeric, 0),
        COALESCE((days->>1)::numeric, 0),
        COALESCE((days->>2)::numeric, 0),
        COALESCE((days->>3)::numeric, 0),
        COALESCE((days->>4)::numeric, 0),
        COALESCE((days->>5)::numeric, 0),
        COALESCE((days->>6)::numeric, 0),
        COALESCE((item->>'rate')::numeric, 20)
      );
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- Useful database view: project summary with costs
-- ============================================================
CREATE OR REPLACE VIEW v_project_summary AS
SELECT
  p.id,
  p.name,
  p.address,
  p.bu,
  p.status,
  p.start_date,
  p.end_date,
  p.invoice,
  p.deposit,
  p.log_runs,
  p.log_miles,
  p.log_cpm,
  p.stor_pulls,
  p.stor_cpp,
  COALESCE(labor.total_labor, 0) AS total_labor,
  COALESCE(misc.total_misc, 0) AS total_misc,
  (p.log_runs * p.log_miles * p.log_cpm) AS total_logistics,
  (p.stor_pulls * p.stor_cpp) AS total_storage,
  (COALESCE(labor.total_labor, 0)
   + COALESCE(misc.total_misc, 0)
   + (p.log_runs * p.log_miles * p.log_cpm)
   + (p.stor_pulls * p.stor_cpp)) AS total_cost,
  (p.invoice - (
    COALESCE(labor.total_labor, 0)
    + COALESCE(misc.total_misc, 0)
    + (p.log_runs * p.log_miles * p.log_cpm)
    + (p.stor_pulls * p.stor_cpp)
  )) AS profit,
  CASE WHEN p.invoice > 0 THEN
    ROUND(((p.invoice - (
      COALESCE(labor.total_labor, 0)
      + COALESCE(misc.total_misc, 0)
      + (p.log_runs * p.log_miles * p.log_cpm)
      + (p.stor_pulls * p.stor_cpp)
    )) / p.invoice) * 100, 1)
  ELSE 0 END AS margin,
  p.created_at
FROM projects p
LEFT JOIN (
  SELECT project_id, SUM(workers * hours * rate) AS total_labor
  FROM project_labor GROUP BY project_id
) labor ON labor.project_id = p.id
LEFT JOIN (
  SELECT project_id, SUM(amount) AS total_misc
  FROM project_misc GROUP BY project_id
) misc ON misc.project_id = p.id;

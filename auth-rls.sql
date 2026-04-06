-- Drop old open policies
DROP POLICY IF EXISTS inventory_all ON inventory;
DROP POLICY IF EXISTS projects_all ON projects;
DROP POLICY IF EXISTS payroll_all ON payroll;

-- Create authenticated-only policies
CREATE POLICY inv_auth ON inventory FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY proj_auth ON projects FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY pay_auth ON payroll FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Update storage: keep public reads, require auth for writes/deletes
DROP POLICY IF EXISTS storage_public_insert ON storage.objects;
DROP POLICY IF EXISTS storage_public_delete ON storage.objects;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'storage_auth_insert' AND tablename = 'objects') THEN
    CREATE POLICY storage_auth_insert ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'inventory-images' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'storage_auth_delete' AND tablename = 'objects') THEN
    CREATE POLICY storage_auth_delete ON storage.objects FOR DELETE USING (bucket_id = 'inventory-images' AND auth.role() = 'authenticated');
  END IF;
END $$;

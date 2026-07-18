"use client";

import { createClient } from "@/lib/supabase/client";
import type { LaborEntry } from "@/lib/types";

/**
 * Manager-safe labor access. Reads/writes only a project's labor list (name,
 * hours, pay rate) — never the project's revenue. Backed by SECURITY DEFINER
 * functions usable by super admins, managers, and the project's owner.
 */
export async function getProjectLabor(projectId: string): Promise<LaborEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_project_labor", {
    p_project_id: projectId,
  });
  if (error) throw error;
  return (data as LaborEntry[]) || [];
}

export async function setProjectLabor(projectId: string, labor: LaborEntry[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_project_labor", {
    p_project_id: projectId,
    p_labor: labor,
  });
  if (error) throw error;
}

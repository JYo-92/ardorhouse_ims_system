"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { sbPost, sbDelete } from "@/lib/supabase/rest";
import type { Project, ProjectFinancials } from "@/lib/types";

async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();

  // Operational data — readable by every authenticated user.
  const { data: rows, error } = await supabase
    .from("projects")
    .select("id,name,address,bu,agent,start_date,end_date,notes,status,rooms,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Financials — RLS only returns rows the user may see (super admin = all,
  // user = their owned projects). Non-owners get nothing for that project.
  const { data: fin, error: finErr } = await supabase
    .from("project_financials")
    .select("*");
  if (finErr) throw finErr;

  const finMap = new Map<string, ProjectFinancials>(
    (fin || []).map((f) => [f.project_id as string, f as ProjectFinancials])
  );

  return (rows || []).map((r): Project => {
    const f = finMap.get(r.id);
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      bu: r.bu,
      agent: r.agent,
      start_date: r.start_date,
      end_date: r.end_date,
      notes: r.notes,
      status: r.status || "Scheduled",
      rooms: r.rooms || {},
      canSeeFinancials: !!f,
      invoice: f ? Number(f.invoice) : 0,
      deposit: f ? Number(f.deposit) : 0,
      contract_value: f ? Number(f.contract_value) : 0,
      contract_owner_id: f ? f.contract_owner_id : null,
      labor: f?.labor || [],
      misc_lines: f?.misc_lines || [],
    };
  });
}

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR("projects", fetchProjects);
  return { projects: data || [], error, isLoading, mutate };
}

/** Operational fields only — any authenticated user may write these. */
export async function saveProjectInfo(p: Project) {
  await sbPost("projects", {
    id: p.id,
    name: p.name,
    address: p.address || null,
    bu: p.bu,
    agent: p.agent || null,
    start_date: p.start_date || null,
    end_date: p.end_date || null,
    notes: p.notes || null,
    status: p.status || "Scheduled",
    rooms: p.rooms || {},
    updated_at: new Date().toISOString(),
  });
}

/** Update an existing project_financials row. RLS allows super admins and the
 *  assigned contract owner. */
export async function updateFinancials(
  projectId: string,
  patch: Partial<Omit<ProjectFinancials, "project_id">>
) {
  const supabase = createClient();
  const { error } = await supabase
    .from("project_financials")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (error) throw error;
}

/** Create a project_financials row (assigning the contract owner). RLS allows
 *  super admins only. */
export async function createFinancials(
  fin: Partial<ProjectFinancials> & { project_id: string }
) {
  const supabase = createClient();
  const { error } = await supabase.from("project_financials").insert({
    project_id: fin.project_id,
    invoice: fin.invoice ?? 0,
    deposit: fin.deposit ?? 0,
    contract_value: fin.contract_value ?? 0,
    labor: fin.labor ?? [],
    misc_lines: fin.misc_lines ?? [],
    contract_owner_id: fin.contract_owner_id ?? null,
  });
  if (error) throw error;
}

export async function deleteProject(id: string) {
  // project_financials cascades on project delete (FK on delete cascade).
  await sbDelete("projects", "id", id);
}

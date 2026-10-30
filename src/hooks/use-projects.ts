"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { sbPost, sbDelete } from "@/lib/supabase/rest";
import type { Project, ProjectFinancials, RoomAssignment } from "@/lib/types";

async function fetchProjects(): Promise<{ projects: Project[]; stockProjects: Project[] }> {
  const supabase = createClient();

  // Operational data — RLS returns every project to admins, managers and
  // installers, and only their assigned projects to designers.
  const { data: rows, error } = await supabase
    .from("projects")
    .select("id,name,address,bu,agent,start_date,end_date,notes,status,rooms,designer_id,salesperson_id,details,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Financials — RLS only returns rows the user may see (super admin = all,
  // user = their owned projects). Non-owners get nothing for that project.
  const { data: fin, error: finErr } = await supabase
    .from("project_financials")
    .select("*");
  if (finErr) throw finErr;

  // Furniture out on every open job, including ones this user can't see, so
  // availability stays honest for designers. Item ids and quantities only.
  const { data: alloc, error: allocErr } = await supabase.rpc("staged_allocations");
  if (allocErr) throw allocErr;

  const finMap = new Map<string, ProjectFinancials>(
    (fin || []).map((f) => [f.project_id as string, f as ProjectFinancials])
  );

  const projects = (rows || []).map((r): Project => {
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
      designer_id: r.designer_id ?? null,
      salesperson_id: r.salesperson_id ?? null,
      details: r.details || {},
      canSeeFinancials: !!f,
      invoice: f ? Number(f.invoice) : 0,
      deposit: f ? Number(f.deposit) : 0,
      contract_value: f ? Number(f.contract_value) : 0,
      contract_owner_id: f ? f.contract_owner_id : null,
      labor: f?.labor || [],
      misc_lines: f?.misc_lines || [],
    };
  });

  const visible = new Set(projects.map((p) => p.id));
  const placeholders = ((alloc || []) as { project_id: string; status: string | null; rooms: Record<string, RoomAssignment[]> | null }[])
    .filter((a) => !visible.has(a.project_id))
    .map((a): Project => ({
      id: a.project_id,
      name: "Another project",
      address: null,
      bu: "",
      agent: null,
      start_date: null,
      end_date: null,
      notes: null,
      status: a.status || "Scheduled",
      rooms: a.rooms || {},
      designer_id: null,
      salesperson_id: null,
      details: {},
      hidden: true,
      canSeeFinancials: false,
      invoice: 0,
      deposit: 0,
      contract_value: 0,
      contract_owner_id: null,
      labor: [],
      misc_lines: [],
    }));

  return { projects, stockProjects: [...projects, ...placeholders] };
}

/** `projects` is what the user may see and list. `stockProjects` adds
 *  placeholders for hidden open jobs — pass it to the inventory availability
 *  helpers (getAvail, getStaged, …), never render it as a project list. */
export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR("projects", fetchProjects);
  return {
    projects: data?.projects || [],
    stockProjects: data?.stockProjects || [],
    error,
    isLoading,
    mutate,
  };
}

/** Operational fields only. Pass `people` (admins and managers) to change the
 *  stager responsible and salesperson; leave it out and they are kept. */
export async function saveProjectInfo(
  p: Project,
  people?: { stagerId: string | null; salespersonId: string | null }
) {
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
    details: p.details || {},
    ...(people ? { designer_id: people.stagerId, salesperson_id: people.salespersonId } : {}),
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

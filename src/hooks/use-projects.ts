"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { sbPost, sbDelete } from "@/lib/supabase/rest";
import type { Project } from "@/lib/types";

async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    bu: r.bu,
    agent: r.agent,
    start_date: r.start_date,
    end_date: r.end_date,
    notes: r.notes,
    status: r.status || "Scheduled",
    invoice: Number(r.invoice),
    deposit: Number(r.deposit),
    rooms: r.rooms || {},
    labor: r.labor || [],
    misc_lines: r.misc_lines || [],
  }));
}

export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR(
    "projects",
    fetchProjects
  );

  return {
    projects: data || [],
    error,
    isLoading,
    mutate,
  };
}

export async function saveProject(p: Project) {
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
    invoice: p.invoice,
    deposit: p.deposit,
    rooms: p.rooms || {},
    labor: p.labor || [],
    misc_lines: p.misc_lines || [],
    updated_at: new Date().toISOString(),
  });
}

export async function deleteProject(id: string) {
  await sbDelete("projects", "id", id);
}

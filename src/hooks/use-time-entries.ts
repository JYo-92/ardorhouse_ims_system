"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { TimeEntry, LaborType } from "@/lib/types";

/** The current user's open (not-yet-clocked-out) entry, if any. */
async function fetchActiveEntry(): Promise<TimeEntry | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", user.id)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as TimeEntry) ?? null;
}

export function useActiveTimeEntry() {
  const { data, error, isLoading, mutate } = useSWR("active-time-entry", fetchActiveEntry, {
    refreshInterval: 30000,
  });
  return { activeEntry: data ?? null, error, isLoading, mutate };
}

export async function clockIn(projectId: string, jobType: LaborType) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("time_entries").insert({
    user_id: user.id,
    project_id: projectId,
    job_type: jobType,
    clock_in: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function clockOut(entryId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", entryId);
  if (error) throw error;
}

/** All entries — RLS returns everything for super admins / managers only. */
async function fetchAllEntries(): Promise<TimeEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .order("clock_in", { ascending: false });
  if (error) throw error;
  return (data || []) as TimeEntry[];
}

export function useAllTimeEntries(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? "all-time-entries" : null,
    fetchAllEntries
  );
  return { entries: data || [], error, isLoading, mutate };
}

/** Hours between clock in and out (or now if still open). */
export function entryHours(e: TimeEntry): number {
  const start = new Date(e.clock_in).getTime();
  const end = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
  return Math.max(0, (end - start) / 3600000);
}

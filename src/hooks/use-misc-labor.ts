"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { MiscLabor } from "@/lib/types";

/** Misc (non-project) labor within a date range, inclusive.
 *  RLS restricts this to admins and managers — same audience as Payroll. */
export function useMiscLabor(startDate: string, endDate: string) {
  const { data, error, isLoading, mutate } = useSWR(
    ["misc-labor", startDate, endDate],
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("misc_labor")
        .select("*")
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return (data || []) as MiscLabor[];
    }
  );
  return { miscLabor: data || [], error, isLoading, mutate };
}

export async function addMiscLabor(entry: Omit<MiscLabor, "id" | "created_at">) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("misc_labor").insert({
    worker_name: entry.worker_name,
    role: entry.role || null,
    work_type: entry.work_type,
    description: entry.description || null,
    work_date: entry.work_date,
    start_time: entry.start_time || null,
    end_time: entry.end_time || null,
    hours: entry.hours ?? null,
    rate: entry.rate || 0,
    created_by: auth.user?.id,
  });
  if (error) throw error;
}

export async function deleteMiscLabor(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("misc_labor").delete().eq("id", id);
  if (error) throw error;
}

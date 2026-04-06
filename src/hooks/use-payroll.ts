"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { sbPost } from "@/lib/supabase/rest";
import type { PayrollEntry } from "@/lib/types";

async function fetchPayroll(): Promise<Record<string, PayrollEntry[]>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("payroll").select("*");
  if (error) throw error;
  const map: Record<string, PayrollEntry[]> = {};
  (data || []).forEach((r) => {
    map[r.week_start] = r.entries || [];
  });
  return map;
}

export function usePayroll() {
  const { data, error, isLoading, mutate } = useSWR("payroll", fetchPayroll);

  return {
    payroll: data || {},
    error,
    isLoading,
    mutate,
  };
}

export async function savePayrollWeek(
  weekStart: string,
  entries: PayrollEntry[]
) {
  await sbPost("payroll", {
    week_start: weekStart,
    entries,
    updated_at: new Date().toISOString(),
  });
}

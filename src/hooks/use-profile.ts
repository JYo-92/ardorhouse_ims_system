"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

/** Current signed-in user's profile (id, email, role). */
async function fetchMyProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    // Profile row not created yet (e.g. pre-migration session) — treat as user.
    return { id: user.id, email: user.email ?? null, full_name: null, role: "user" };
  }
  return data as Profile;
}

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR("my-profile", fetchMyProfile);
  const profile = data ?? null;
  const role = profile?.role ?? null;
  return {
    profile,
    role,
    userId: profile?.id ?? null,
    isSuperAdmin: role === "super_admin",
    // Weekly Payroll is visible to super admins and managers.
    canSeePayroll: role === "super_admin" || role === "manager",
    error,
    isLoading,
    mutate,
  };
}

/** All profiles — only returns rows for super admins (RLS). Used for the
 *  contract-owner dropdown and the admin role-management screen. */
async function fetchProfiles(): Promise<Profile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .order("email", { ascending: true });
  if (error) throw error;
  return (data || []) as Profile[];
}

export function useProfiles(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? "profiles" : null,
    fetchProfiles
  );
  return { profiles: data || [], error, isLoading, mutate };
}

export async function updateProfileRole(id: string, role: Profile["role"]) {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

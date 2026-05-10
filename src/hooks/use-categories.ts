"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { sbPost, sbDelete } from "@/lib/supabase/rest";

async function fetchCategories(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .order("name", { ascending: true });
  if (error) {
    // Table may not exist yet — return empty list so UI doesn't break.
    console.warn("categories fetch failed:", error.message);
    return [];
  }
  return (data || []).map((r) => r.name as string);
}

export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR("categories", fetchCategories);
  return { categories: data || [], error, isLoading, mutate };
}

export async function addCategory(name: string) {
  await sbPost("categories", { name: name.trim() });
}

export async function deleteCategory(name: string) {
  await sbDelete("categories", "name", name);
}

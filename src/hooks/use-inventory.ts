"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { sbPost, sbDelete } from "@/lib/supabase/rest";
import type { InventoryItem } from "@/lib/types";

async function fetchInventory(): Promise<InventoryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    size: r.size,
    qty: r.qty,
    cost: Number(r.cost),
    status: r.status,
    notes: r.notes,
    images: r.images || [],
    location_id: r.location_id,
  }));
}

export function useInventory() {
  const { data, error, isLoading, mutate } = useSWR(
    "inventory",
    fetchInventory
  );

  return {
    inventory: data || [],
    error,
    isLoading,
    mutate,
  };
}

export async function saveInventoryItem(item: InventoryItem) {
  await sbPost("inventory", {
    id: item.id,
    name: item.name,
    category: item.category,
    size: item.size || null,
    qty: item.qty,
    cost: item.cost,
    status: item.status,
    notes: item.notes || null,
    images: item.images || [],
    updated_at: new Date().toISOString(),
  });
}

export async function deleteInventoryItem(id: string) {
  await sbDelete("inventory", "id", id);
}

export async function uploadImage(file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "png";
  const fname = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from("inventory-images")
    .upload(fname, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage
    .from("inventory-images")
    .getPublicUrl(fname);
  return data.publicUrl;
}

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

/**
 * Shrink a photo in the browser before it is uploaded.
 *
 * Phone cameras produce 3–4000px files of half a megabyte upwards. Nothing in
 * the app ever displays them larger than a full screen, so we cap the long edge
 * and re-encode as JPEG. Photos stay perfectly sharp in the grid and in the
 * enlarge/lightbox view, but typically land at a fifth of the original size —
 * which keeps storage down and makes the inventory load much faster on phones.
 *
 * Anything we cannot decode (e.g. HEIC in a browser without support) is passed
 * through untouched rather than failing the upload.
 */
export async function compressImage(
  file: File,
  maxDim = 1800,
  quality = 0.85
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    // from-image keeps EXIF rotation, so portrait shots don't come out sideways.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));

    // Already modest in both dimensions and file size — leave it alone.
    if (scale === 1 && file.size < 400_000) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    // If re-encoding didn't actually help, keep the original.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

export async function uploadImage(file: File): Promise<string> {
  const supabase = createClient();
  const toUpload = await compressImage(file);
  const ext = toUpload.name.split(".").pop() || "jpg";
  const fname = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from("inventory-images")
    .upload(fname, toUpload, { contentType: toUpload.type });
  if (error) throw error;
  const { data } = supabase.storage
    .from("inventory-images")
    .getPublicUrl(fname);
  return data.publicUrl;
}

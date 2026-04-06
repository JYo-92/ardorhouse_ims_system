import { createClient } from "./client";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
    // Fallback: try localStorage directly (matches old HTML app)
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("sb-wdyrngcknoswtuhawzgj-auth-token");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed?.access_token || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function sbPost(table: string, row: Record<string, unknown>) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please sign in again.");
  }
  const resp = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SB_KEY,
      Authorization: "Bearer " + token,
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt);
  }
}

export async function sbDelete(table: string, column: string, value: string) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Not authenticated. Please sign in again.");
  }
  const resp = await fetch(
    `${SB_URL}/rest/v1/${table}?${column}=eq.${encodeURIComponent(value)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + token,
      },
    }
  );
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt);
  }
}

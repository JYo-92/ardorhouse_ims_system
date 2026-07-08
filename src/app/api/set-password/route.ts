import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin-only: set a temporary password for a team member (e.g. when they're
// locked out). The admin performs this in-app; the privileged key stays on the
// server. The person can change it later via Forgot Password.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Only admins can reset passwords." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.user_id;
  const password = body.password;
  if (!userId || typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Pick a user and a password of at least 8 characters." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

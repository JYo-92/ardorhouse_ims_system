import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["super_admin", "manager", "user", "installer"];

export async function POST(req: Request) {
  // 1. Confirm the caller is signed in AND a super admin.
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
    return NextResponse.json({ error: "Only admins can invite people." }, { status: 403 });
  }

  // 2. Validate input.
  const body = await req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const full_name = (body.full_name || "").trim();
  const job_title = (body.job_title || "").trim();
  const role = body.role;
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Pick a valid role." }, { status: 400 });
  }

  // 3. Send the invite using the privileged admin client (server-only).
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  const origin = new URL(req.url).origin;
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: full_name || null, job_title: job_title || null, role },
    redirectTo: `${origin}/accept-invite`,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

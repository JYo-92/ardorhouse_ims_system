import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Permanently remove a team member's account.
 *
 * Deleting the auth user cascades to their profile row. Anything they merely
 * touched (contacts, notes, tasks, project financials) is kept and simply
 * loses the reference, because those columns are ON DELETE SET NULL. Their
 * clock-in history is the one exception — time_entries cascades — so the
 * caller is told the count up front and must opt in.
 */
export async function POST(req: Request) {
  // 1. Caller must be signed in AND a super admin.
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
    return NextResponse.json(
      { error: "Only admins can remove people." },
      { status: 403 }
    );
  }

  // 2. Validate the target.
  const body = await req.json().catch(() => ({}));
  const targetId = (body.id || "").trim();
  const confirmed = body.confirm === true;
  if (!targetId) {
    return NextResponse.json({ error: "Which user?" }, { status: 400 });
  }
  if (targetId === user.id) {
    return NextResponse.json(
      { error: "You can't remove your own account." },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { data: target } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", targetId)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "That user no longer exists." }, { status: 404 });
  }

  // Never let the last admin be removed — that would lock everyone out of
  // user management with no way back in through the app.
  if (target.role === "super_admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "That's the only admin left. Make someone else an admin first." },
        { status: 400 }
      );
    }
  }

  // 3. Report what would be lost, and stop unless the caller has confirmed.
  const { count: timeEntries } = await admin
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", targetId);

  if (!confirmed) {
    return NextResponse.json({
      needsConfirm: true,
      name: target.full_name || target.email,
      timeEntries: timeEntries ?? 0,
    });
  }

  // 4. Delete. The profile row goes with it via ON DELETE CASCADE.
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, timeEntries: timeEntries ?? 0 });
}

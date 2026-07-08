"use client";

import { useState } from "react";
import { useProfile, useProfiles, updateProfileRole } from "@/hooks/use-profile";
import { useToast } from "@/components/layout/toast-provider";
import type { Role } from "@/lib/types";

// Friendly job titles that map to access levels. No "user/super_admin" jargon.
const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "installer", label: "Installer", desc: "Clock in/out only" },
  { value: "user", label: "Designer", desc: "Projects & furniture, no money" },
  { value: "manager", label: "Manager", desc: "Adds Weekly Payroll" },
  { value: "super_admin", label: "Admin", desc: "Full access" },
];
const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label || r;

export default function AdminPage() {
  const { isSuperAdmin, isLoading: profileLoading, userId } = useProfile();
  const { profiles, isLoading, mutate } = useProfiles(isSuperAdmin);
  const { toast } = useToast();

  // Invite form
  const [iName, setIName] = useState("");
  const [iEmail, setIEmail] = useState("");
  const [iRole, setIRole] = useState<Role>("user");
  const [inviting, setInviting] = useState(false);

  if (!profileLoading && !isSuperAdmin) {
    return (
      <div className="py-16 text-center text-muted">
        <div className="text-3xl">🔒</div>
        <p className="mt-2 text-sm">This page is available to admins only.</p>
      </div>
    );
  }

  async function changeRole(id: string, role: Role) {
    try {
      await updateProfileRole(id, role);
      await mutate();
      toast("Access updated");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  }

  async function resetPassword(id: string, name: string) {
    const pw = window.prompt(
      `Set a temporary password for ${name}.\nThey can change it later via "Forgot password".`,
      "Ardor2026!"
    );
    if (pw === null) return; // cancelled
    if (pw.length < 8) { toast("Password must be at least 8 characters", "error"); return; }
    try {
      const res = await fetch("/api/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set password");
      toast(`Password set. Share it with ${name}: ${pw}`);
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!iEmail.trim()) { toast("Email is required", "error"); return; }
    setInviting(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: iName.trim(),
          email: iEmail.trim(),
          job_title: roleLabel(iRole),
          role: iRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed");
      toast(`Invite sent to ${iEmail.trim()} ✓`);
      setIName(""); setIEmail(""); setIRole("user");
      await mutate();
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Settings — Users</h1>
      <p className="text-xs text-muted mb-5">Invite your team and set what each person can access.</p>

      {/* Invite */}
      <div className="bg-card rounded-lg shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold mb-3">Add a User</h2>
        <form onSubmit={sendInvite} className="grid grid-cols-[1.2fr_1.5fr_1.3fr_auto] gap-3 items-end max-md:grid-cols-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted">Name</label>
            <input value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Full name" className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted">Email</label>
            <input type="email" value={iEmail} onChange={(e) => setIEmail(e.target.value)} placeholder="name@email.com" className="py-2 px-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-accent" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted">Job title / access</label>
            <select value={iRole} onChange={(e) => setIRole(e.target.value as Role)} className="py-2 px-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent">
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
            </select>
          </div>
          <button type="submit" disabled={inviting} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-accent text-white border-none hover:bg-accent2 disabled:opacity-50 h-[38px]">
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </form>
        <p className="text-[.7rem] text-muted mt-2">They&apos;ll get an email to set their password and get in.</p>
      </div>

      {/* Existing users */}
      <h2 className="text-sm font-semibold mb-2">Team</h2>
      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="py-12 text-center text-muted text-sm">Loading…</div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">No users yet.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Name", "Email", "Access", ""].map((h, i) => (
                  <th key={i} className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 px-3 border-b border-border">{u.full_name || "—"}</td>
                  <td className="py-2.5 px-3 border-b border-border">{u.email || "—"}</td>
                  <td className="py-2.5 px-3 border-b border-border">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as Role)}
                      disabled={u.id === userId}
                      title={u.id === userId ? "You can't change your own access" : undefined}
                      className="py-1.5 px-2 border border-border rounded text-sm bg-card disabled:opacity-50"
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">
                    <button
                      onClick={() => resetPassword(u.id, u.full_name || u.email || "this user")}
                      className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background"
                    >
                      Reset Password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

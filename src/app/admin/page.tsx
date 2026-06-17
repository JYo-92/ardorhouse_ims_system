"use client";

import { useProfile, useProfiles, updateProfileRole } from "@/hooks/use-profile";
import { useToast } from "@/components/layout/toast-provider";
import type { Role } from "@/lib/types";

const ROLES: { value: Role; label: string }[] = [
  { value: "user", label: "User" },
  { value: "manager", label: "Manager" },
  { value: "super_admin", label: "Super Admin" },
];

export default function AdminPage() {
  const { isSuperAdmin, isLoading: profileLoading, userId } = useProfile();
  const { profiles, isLoading, mutate } = useProfiles(isSuperAdmin);
  const { toast } = useToast();

  if (!profileLoading && !isSuperAdmin) {
    return (
      <div className="py-16 text-center text-muted">
        <div className="text-3xl">🔒</div>
        <p className="mt-2 text-sm">This page is available to administrators only.</p>
      </div>
    );
  }

  async function changeRole(id: string, role: Role) {
    try {
      await updateProfileRole(id, role);
      await mutate();
      toast("Role updated");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Users &amp; Roles</h1>
      <p className="text-xs text-muted mb-5">
        Super admins see all project financials. Users see money only for projects where they are
        the contract owner. New users are created in Supabase and default to “User”.
      </p>

      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="py-12 text-center text-muted text-sm">Loading…</div>
        ) : profiles.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">No users found.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Name", "Email", "Role"].map((h) => (
                  <th key={h} className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">{h}</th>
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
                      title={u.id === userId ? "You can't change your own role" : undefined}
                      className="py-1.5 px-2 border border-border rounded text-sm bg-card disabled:opacity-50"
                    >
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
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

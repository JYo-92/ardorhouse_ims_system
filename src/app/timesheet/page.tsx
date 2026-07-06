"use client";

import { useProfile, useProfiles } from "@/hooks/use-profile";
import { useProjects } from "@/hooks/use-projects";
import { useAllTimeEntries, entryHours } from "@/hooks/use-time-entries";

export default function TimesheetPage() {
  const { role, isLoading: profileLoading } = useProfile();
  const canView = role === "super_admin" || role === "manager";
  const { entries, isLoading } = useAllTimeEntries(canView);
  const { profiles } = useProfiles(canView);
  const { projects } = useProjects();

  if (!profileLoading && !canView) {
    return (
      <div className="py-16 text-center text-muted">
        <div className="text-3xl">🔒</div>
        <p className="mt-2 text-sm">The Time Clock is available to managers and administrators only.</p>
      </div>
    );
  }

  const nameFor = (userId: string) => {
    const p = profiles.find((u) => u.id === userId);
    return p?.full_name || p?.email || "Unknown";
  };
  const projectFor = (id: string) => projects.find((p) => p.id === id)?.name || "—";
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

  const totalHours = entries
    .filter((e) => e.clock_out)
    .reduce((s, e) => s + entryHours(e), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Time Clock</h1>
      <p className="text-xs text-muted mb-5">Hours logged by installers via the clock in/out screen.</p>

      <div className="flex gap-3.5 mb-5">
        <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
          <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">Total Logged Hours</div>
          <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
        </div>
        <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
          <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">Currently Clocked In</div>
          <div className="text-2xl font-bold text-green">{entries.filter((e) => !e.clock_out).length}</div>
        </div>
      </div>

      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="py-12 text-center text-muted text-sm">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">No time entries yet.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Installer", "Project", "Type", "Date", "In", "Out", "Hours"].map((h) => (
                  <th key={h} className={`bg-background py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted border-b border-border whitespace-nowrap ${h === "Hours" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-[#f9fafb]">
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap font-semibold">{nameFor(e.user_id)}</td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{projectFor(e.project_id)}</td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{e.job_type}</td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{fmtDate(e.clock_in)}</td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{fmtTime(e.clock_in)}</td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">
                    {e.clock_out ? fmtTime(e.clock_out) : <span className="inline-block py-0.5 px-2 rounded-full text-xs font-semibold bg-[#dcfce7] text-[#16a34a]">In progress</span>}
                  </td>
                  <td className="py-2.5 px-3 border-b border-border text-right whitespace-nowrap font-semibold">
                    {e.clock_out ? entryHours(e).toFixed(2) : "—"}
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

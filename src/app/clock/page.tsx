"use client";

import { useState, useEffect } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useProfile } from "@/hooks/use-profile";
import { useActiveTimeEntry, clockIn, clockOut, entryHours } from "@/hooks/use-time-entries";
import { useToast } from "@/components/layout/toast-provider";
import { createClient } from "@/lib/supabase/client";
import { LABOR_TYPES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import type { LaborType } from "@/lib/types";

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function ClockPage() {
  const { projects } = useProjects();
  const { profile } = useProfile();
  const { activeEntry, mutate } = useActiveTimeEntry();
  const { toast } = useToast();
  const router = useRouter();

  const [projectId, setProjectId] = useState("");
  const [jobType, setJobType] = useState<LaborType>("Staging");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Live ticking clock while clocked in.
  useEffect(() => {
    if (!activeEntry) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeEntry]);

  // Only active / in-progress jobs in the picker.
  const activeProjects = projects.filter((p) => p.status !== "Completed");
  const activeProjectName =
    projects.find((p) => p.id === activeEntry?.project_id)?.name || "Project";

  async function handleClockIn() {
    if (!projectId) { toast("Pick a project first", "error"); return; }
    setBusy(true);
    try {
      await clockIn(projectId, jobType);
      await mutate();
      toast("Clocked in ✓");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    if (!activeEntry) return;
    setBusy(true);
    try {
      await clockOut(activeEntry.id);
      await mutate();
      const hrs = entryHours({ ...activeEntry, clock_out: new Date().toISOString() });
      toast(`Clocked out — ${hrs.toFixed(2)} hrs logged ✓`);
      setProjectId("");
    } catch (err) {
      toast("Error: " + (err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
  }

  const firstName = (profile?.full_name || profile?.email || "there").split(/[\s@]/)[0];

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white flex flex-col items-center px-5 pt-10 pb-8">
      <div className="w-full max-w-[440px] flex flex-col items-center">
        <div className="text-2xl font-bold text-[#e2b87e] tracking-wide">Ardor House</div>
        <div className="text-[.7rem] text-white/40 uppercase tracking-[2px] mb-8">Time Clock</div>

        <p className="text-white/70 text-sm mb-6">Hi {firstName} 👋</p>

        {activeEntry ? (
          /* ---- Clocked in ---- */
          <div className="w-full flex flex-col items-center text-center">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-1">Clocked in to</div>
            <div className="text-2xl font-semibold mb-1">{activeProjectName}</div>
            <div className="inline-block py-1 px-3 rounded-full text-xs font-semibold bg-white/10 mb-6">
              {activeEntry.job_type}
            </div>

            <div className="text-5xl font-bold tabular-nums text-[#e2b87e] mb-1">
              {fmtElapsed(now - new Date(activeEntry.clock_in).getTime())}
            </div>
            <div className="text-xs text-white/40 mb-8">
              since {new Date(activeEntry.clock_in).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </div>

            <button
              onClick={handleClockOut}
              disabled={busy}
              className="w-full py-5 rounded-2xl bg-red text-white text-lg font-bold border-none cursor-pointer active:scale-[.98] transition-transform disabled:opacity-50"
            >
              {busy ? "…" : "Clock Out"}
            </button>
          </div>
        ) : (
          /* ---- Not clocked in ---- */
          <div className="w-full flex flex-col gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full py-4 px-4 rounded-xl bg-white/[.08] border border-white/15 text-white text-base focus:outline-none focus:border-[#e2b87e]"
              >
                <option value="" className="text-black">Select a project…</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id} className="text-black">{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">Job type</label>
              <div className="grid grid-cols-2 gap-2">
                {LABOR_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setJobType(t)}
                    className={`py-3.5 rounded-xl text-base font-semibold border transition-colors ${jobType === t ? "bg-[#e2b87e] text-[#1a1a2e] border-[#e2b87e]" : "bg-white/[.06] text-white/80 border-white/15"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleClockIn}
              disabled={busy || !projectId}
              className="w-full py-5 mt-2 rounded-2xl bg-green text-white text-lg font-bold border-none cursor-pointer active:scale-[.98] transition-transform disabled:opacity-40"
            >
              {busy ? "…" : "Clock In"}
            </button>
          </div>
        )}

        <button
          onClick={signOut}
          className="mt-10 text-white/40 text-sm bg-transparent border-none cursor-pointer hover:text-white/70"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

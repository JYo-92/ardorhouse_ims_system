"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/use-projects";
import { formatMoney, getLaborHours, getLaborCost } from "@/lib/calculations";
import { DAY_LABELS } from "@/lib/constants";

function fmtYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return fmtYMD(d);
}

type Row = {
  name: string;
  roles: Set<string>;
  days: number[]; // hours per day Mon..Sun
  totalPay: number;
  projects: Map<string, string>; // projectId -> projectName
};

export default function PayrollPage() {
  const { projects } = useProjects();
  const [week, setWeek] = useState(getMonday());

  // Week boundary as local-midnight Date and YMD strings
  const weekStart = new Date(week + "T00:00:00");
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekStartStr = week;
  const weekEndStr = fmtYMD(weekEndDate);

  // Aggregate labor entries that fall in this week
  const map = new Map<string, Row>();
  projects.forEach((p) => {
    (p.labor || []).forEach((l) => {
      if (!l.date || l.date < weekStartStr || l.date > weekEndStr) return;
      const ed = new Date(l.date + "T00:00:00");
      const dayIdx = (ed.getDay() + 6) % 7; // 0 = Monday
      const name = (l.name || "").trim() || "(unnamed)";
      if (!map.has(name)) {
        map.set(name, { name, roles: new Set(), days: [0, 0, 0, 0, 0, 0, 0], totalPay: 0, projects: new Map() });
      }
      const row = map.get(name)!;
      if (l.role) row.roles.add(l.role);
      row.days[dayIdx] += getLaborHours(l);
      row.totalPay += getLaborCost(l);
      row.projects.set(p.id, p.name);
    });
  });
  const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

  const totalHours = rows.reduce((sum, r) => sum + r.days.reduce((a, b) => a + b, 0), 0);
  const totalPay = rows.reduce((sum, r) => sum + r.totalPay, 0);

  // Format the week range for the header (e.g. "May 4 – 10, 2026")
  const fmtMonth = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric" });
  const sameYear = weekStart.getFullYear() === weekEndDate.getFullYear();
  const rangeLabel = sameYear
    ? `${fmtMonth(weekStart)} – ${fmtMonth(weekEndDate)}, ${weekEndDate.getFullYear()}`
    : `${fmtMonth(weekStart)}, ${weekStart.getFullYear()} – ${fmtMonth(weekEndDate)}, ${weekEndDate.getFullYear()}`;

  function shiftWeek(deltaDays: number) {
    const d = new Date(week + "T00:00:00");
    d.setDate(d.getDate() + deltaDays);
    setWeek(fmtYMD(d));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Weekly Payroll</h1>
      <p className="text-xs text-muted mb-5">Auto-calculated from project labor entries (Date + Start/End time + Rate).</p>

      <div className="flex items-end gap-2 flex-wrap mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted">Week Starting (Monday)</label>
          <input
            type="date"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="py-2 px-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
          />
        </div>
        <button onClick={() => shiftWeek(-7)} className="py-2 px-3 text-sm font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background">← Prev</button>
        <button onClick={() => setWeek(getMonday())} className="py-2 px-3 text-sm font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background">This Week</button>
        <button onClick={() => shiftWeek(7)} className="py-2 px-3 text-sm font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background">Next →</button>
        <div className="ml-auto text-sm text-muted self-center">{rangeLabel}</div>
      </div>

      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-12 px-5 text-center text-muted">
            <div className="text-3xl">💰</div>
            <p className="mt-1.5 text-sm">No labor entries logged for this week.</p>
            <p className="mt-1 text-xs">Add labor on a project (Labor tab) with a date in this range.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Name</th>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Role</th>
                {DAY_LABELS.map((d) => (
                  <th key={d} className="bg-background py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wider text-muted border-b border-border w-[60px]">{d}</th>
                ))}
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Hrs</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Pay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hrs = r.days.reduce((a, b) => a + b, 0);
                return (
                  <tr key={r.name} className="hover:bg-[#f9fafb] align-top">
                    <td className="py-2 px-3 border-b border-border">
                      <strong>{r.name}</strong>
                      {r.projects.size > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Array.from(r.projects.entries()).map(([id, name]) => (
                            <Link
                              key={id}
                              href={`/projects/${id}`}
                              className="inline-block py-0.5 px-1.5 rounded bg-[#e0e7ff] text-[#4338ca] text-[.65rem] font-semibold no-underline hover:bg-[#c7d2fe]"
                            >
                              {name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 border-b border-border whitespace-nowrap">{Array.from(r.roles).join(" / ") || "—"}</td>
                    {r.days.map((d, di) => (
                      <td key={di} className={`py-2 px-1 border-b border-border text-center text-sm ${d > 0 ? "font-semibold" : "text-muted"}`}>
                        {d > 0 ? d.toFixed(1) : "—"}
                      </td>
                    ))}
                    <td className="py-2 px-3 border-b border-border text-right font-semibold">{hrs.toFixed(1)}</td>
                    <td className="py-2 px-3 border-b border-border text-right font-semibold">{formatMoney(r.totalPay)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mt-4">
          <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
            <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">Total Hours</div>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
          </div>
          <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
            <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">Total Pay</div>
            <div className="text-2xl font-bold text-green">{formatMoney(totalPay)}</div>
          </div>
          <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
            <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">People</div>
            <div className="text-2xl font-bold">{rows.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}

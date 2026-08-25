"use client";

import { useState } from "react";
import Link from "next/link";
import { useProjects } from "@/hooks/use-projects";
import { useProfile } from "@/hooks/use-profile";
import { formatMoney, getLaborHours, getLaborCost } from "@/lib/calculations";

/**
 * Payroll runs on a semi-monthly cycle: the 1st–15th, then the 16th–end of
 * month, matching the two paychecks we issue each month. Everything is
 * derived from the labor Smith logs against projects (date + start/end time
 * + rate), so there is nothing separate to key in here.
 */

function fmtYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Last calendar day of the month that `d` falls in. */
function lastDayOfMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** The pay period containing a given date, as {start,end} YMD strings. */
function periodFor(d: Date): { start: string; end: string } {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (d.getDate() <= 15) {
    return { start: fmtYMD(new Date(y, m, 1)), end: fmtYMD(new Date(y, m, 15)) };
  }
  return {
    start: fmtYMD(new Date(y, m, 16)),
    end: fmtYMD(new Date(y, m, lastDayOfMonth(d))),
  };
}

/** Step one pay period backwards or forwards from a period start. */
function shiftPeriod(startStr: string, dir: 1 | -1): string {
  const s = new Date(startStr + "T00:00:00");
  const y = s.getFullYear();
  const m = s.getMonth();
  const isFirstHalf = s.getDate() === 1;
  if (dir === 1) {
    return isFirstHalf
      ? fmtYMD(new Date(y, m, 16))
      : fmtYMD(new Date(y, m + 1, 1));
  }
  return isFirstHalf
    ? fmtYMD(new Date(y, m - 1, 16))
    : fmtYMD(new Date(y, m, 1));
}

type Row = {
  name: string;
  roles: Set<string>;
  dates: Set<string>;
  hours: number;
  pay: number;
  /** Hours logged against an entry with no pay rate — they would silently
   *  pay as $0, so they are called out rather than quietly dropped. */
  unratedHours: number;
  projects: Map<string, string>;
};

export default function PayrollPage() {
  const { projects } = useProjects();
  const { canSeePayroll, isLoading: profileLoading } = useProfile();
  const [periodStart, setPeriodStart] = useState(() => periodFor(new Date()).start);

  const start = new Date(periodStart + "T00:00:00");
  const { end: periodEnd } = periodFor(start);

  // Aggregate every labor entry that falls inside this pay period.
  const map = new Map<string, Row>();
  projects.forEach((p) => {
    (p.labor || []).forEach((l) => {
      if (!l.date || l.date < periodStart || l.date > periodEnd) return;
      const raw = (l.name || "").trim() || "(unnamed)";
      // Group case-insensitively: "Simon" and "SIMON" are one person and must
      // land on one paycheck, not two half-lines.
      const key = raw.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: raw,
          roles: new Set(),
          dates: new Set(),
          hours: 0,
          pay: 0,
          unratedHours: 0,
          projects: new Map(),
        });
      }
      const row = map.get(key)!;
      const entryHours = getLaborHours(l);
      if (!l.rate) row.unratedHours += entryHours;
      if (l.role) row.roles.add(l.role);
      row.dates.add(l.date);
      row.hours += entryHours;
      row.pay += getLaborCost(l);
      row.projects.set(p.id, p.name);
    });
  });
  const rows = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalPay = rows.reduce((s, r) => s + r.pay, 0);
  const unratedTotal = rows.reduce((s, r) => s + r.unratedHours, 0);

  const endDate = new Date(periodEnd + "T00:00:00");
  const monthName = start.toLocaleString("en-US", { month: "long" });
  const rangeLabel = `${monthName} ${start.getDate()}–${endDate.getDate()}, ${start.getFullYear()}`;
  const payDateLabel = endDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });

  const isCurrentPeriod = periodStart === periodFor(new Date()).start;

  if (!profileLoading && !canSeePayroll) {
    return (
      <div className="py-16 text-center text-muted">
        <div className="text-3xl">🔒</div>
        <p className="mt-2 text-sm">Payroll is available to managers and administrators only.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Payroll</h1>
      <p className="text-xs text-muted mb-5">
        Paid twice monthly — the 1st–15th and the 16th–end of month. Calculated
        from project labor entries (date, start/end time and rate).
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button
          onClick={() => setPeriodStart(shiftPeriod(periodStart, -1))}
          className="py-2 px-3 text-sm font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background"
        >
          ← Prev
        </button>
        <button
          onClick={() => setPeriodStart(periodFor(new Date()).start)}
          disabled={isCurrentPeriod}
          className="py-2 px-3 text-sm font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background disabled:opacity-50"
        >
          Current
        </button>
        <button
          onClick={() => setPeriodStart(shiftPeriod(periodStart, 1))}
          className="py-2 px-3 text-sm font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer hover:bg-background"
        >
          Next →
        </button>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{rangeLabel}</span>
          <span className="text-xs text-muted">Pay date {payDateLabel}</span>
        </div>
      </div>

      {unratedTotal > 0 && (
        <div className="mb-3 rounded-lg border border-red/40 bg-red/5 py-2.5 px-3.5 text-sm">
          <strong className="text-red">{unratedTotal.toFixed(1)} hours have no pay rate</strong>
          <span className="text-muted"> — those hours count as $0 owed. Add a rate on the project&apos;s Labor tab to include them.</span>
        </div>
      )}

      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-12 px-5 text-center text-muted">
            <div className="text-3xl">💰</div>
            <p className="mt-1.5 text-sm">No labor logged in this pay period.</p>
            <p className="mt-1 text-xs">Add labor on a project (Labor tab) with a date between {periodStart} and {periodEnd}.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Name</th>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Role</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Days</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Hours</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Owed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="align-top">
                  <td className="py-2 px-3 border-b border-border">
                    <strong>{r.name}</strong>
                    {r.unratedHours > 0 && (
                      <div className="text-[.65rem] text-red font-semibold mt-0.5">
                        ⚠ {r.unratedHours.toFixed(1)} hrs have no pay rate
                      </div>
                    )}
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
                  <td className="py-2 px-3 border-b border-border whitespace-nowrap">
                    {Array.from(r.roles).join(" / ") || "—"}
                  </td>
                  <td className="py-2 px-3 border-b border-border text-right">{r.dates.size}</td>
                  <td className="py-2 px-3 border-b border-border text-right font-semibold">{r.hours.toFixed(1)}</td>
                  <td className="py-2 px-3 border-b border-border text-right font-semibold">{formatMoney(r.pay)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2.5 px-3 font-semibold" colSpan={3}>Total</td>
                <td className="py-2.5 px-3 text-right font-bold">{totalHours.toFixed(1)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-green">{formatMoney(totalPay)}</td>
              </tr>
            </tfoot>
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
            <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">Total Owed</div>
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

"use client";

import { useMemo, useState } from "react";
import { BUSINESS_UNITS } from "@/lib/constants";
import { formatMoney } from "@/lib/calculations";
import type { Project, TeamMember } from "@/lib/types";

type Grain = "month" | "quarter" | "year";
type Credit = "sold" | "staged";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const UNASSIGNED = "__unassigned";

/**
 * Revenue by person and by job type. Revenue is a project's invoice amount,
 * dated by its start / install date. A person gets full credit in "Sold" for
 * jobs they sold and in "Staged" for jobs they were stager on — the two views
 * are never added together, so company totals don't double-count.
 */
export function RevenueTab({ projects, team }: { projects: Project[]; team: TeamMember[] }) {
  const thisYear = new Date().getFullYear();
  const [grain, setGrain] = useState<Grain>("month");
  const [credit, setCredit] = useState<Credit>("sold");
  const [year, setYear] = useState(thisYear);

  // Dates are YYYY-MM-DD strings; slice instead of new Date() so timezones
  // can't push a 1st-of-month install into the previous month.
  const dated = projects.filter((p) => p.start_date && p.invoice);
  const undated = projects.filter((p) => !p.start_date && p.invoice);
  const years = useMemo(() => {
    const ys = new Set(dated.map((p) => Number(p.start_date!.slice(0, 4))));
    ys.add(thisYear);
    return [...ys].sort((a, b) => a - b);
  }, [dated, thisYear]);

  const periods: { key: string; label: string }[] =
    grain === "month"
      ? MONTHS.map((m, i) => ({ key: `${year}-${String(i + 1).padStart(2, "0")}`, label: m }))
      : grain === "quarter"
        ? [1, 2, 3, 4].map((q) => ({ key: `${year}-Q${q}`, label: `Q${q}` }))
        : years.map((y) => ({ key: String(y), label: String(y) }));

  const periodOf = (p: Project) => {
    const d = p.start_date!;
    if (grain === "year") return d.slice(0, 4);
    if (grain === "quarter") return `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
    return d.slice(0, 7);
  };
  const inView = dated.filter((p) => grain === "year" || p.start_date!.startsWith(String(year)));
  const personOf = (p: Project) => (credit === "sold" ? p.salesperson_id : p.designer_id) || UNASSIGNED;

  const nameOf = (id: string) =>
    id === UNASSIGNED ? "Unassigned" : team.find((t) => t.id === id)?.full_name || "Former user";

  // grid[rowKey][periodKey] = revenue
  function grid(rowOf: (p: Project) => string) {
    const g: Record<string, Record<string, number>> = {};
    const jobs: Record<string, number> = {};
    inView.forEach((p) => {
      const r = rowOf(p);
      const k = periodOf(p);
      g[r] ??= {};
      g[r][k] = (g[r][k] || 0) + p.invoice;
      jobs[r] = (jobs[r] || 0) + 1;
    });
    return { g, jobs };
  }

  const byPerson = grid(personOf);
  const personRows = Object.keys(byPerson.g).sort((a, b) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return rowTotal(byPerson.g[b]) - rowTotal(byPerson.g[a]);
  });
  const byType = grid((p) => p.bu || "Other");
  const typeRows = [...BUSINESS_UNITS.filter((t) => byType.g[t]), ...Object.keys(byType.g).filter((t) => !(BUSINESS_UNITS as readonly string[]).includes(t))];

  // Person × job type for the whole view (year, or all years).
  const mix: Record<string, Record<string, number>> = {};
  inView.forEach((p) => {
    const r = personOf(p);
    mix[r] ??= {};
    mix[r][p.bu] = (mix[r][p.bu] || 0) + p.invoice;
  });

  const total = inView.reduce((s, p) => s + p.invoice, 0);
  const top = personRows.find((r) => r !== UNASSIGNED);
  const scope = grain === "year" ? "All years" : String(year);

  const pill = (active: boolean) =>
    `py-1.5 px-3 text-sm font-semibold rounded-lg border cursor-pointer ${active ? "bg-accent text-white border-accent" : "bg-card text-foreground border-border hover:bg-background"}`;

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <div className="flex gap-1">
          {(["month", "quarter", "year"] as Grain[]).map((g) => (
            <button key={g} onClick={() => setGrain(g)} className={pill(grain === g)}>
              {g === "month" ? "Monthly" : g === "quarter" ? "Quarterly" : "Yearly"}
            </button>
          ))}
        </div>
        {grain !== "year" && (
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <div className="flex gap-1 ml-auto">
          <button onClick={() => setCredit("sold")} className={pill(credit === "sold")}>Sold (salesperson)</button>
          <button onClick={() => setCredit("staged")} className={pill(credit === "staged")}>Staged (stager)</button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mb-6">
        <Stat label={`Revenue · ${scope}`} value={formatMoney(total)} />
        <Stat label="Jobs" value={inView.length} />
        <Stat label="Avg per Job" value={inView.length ? formatMoney(total / inView.length) : "—"} />
        <Stat label={credit === "sold" ? "Top Seller" : "Top Stager"} value={top ? nameOf(top) : "—"} />
      </div>

      <h2 className="text-base font-semibold mb-2">Revenue by Person — {credit === "sold" ? "jobs they sold" : "jobs they staged"}</h2>
      <PeriodTable
        rows={personRows.map((r) => ({ key: r, label: nameOf(r), cells: byPerson.g[r], jobs: byPerson.jobs[r], muted: r === UNASSIGNED }))}
        periods={periods}
      />

      <h2 className="text-base font-semibold mb-2 mt-6">Revenue by Job Type</h2>
      <PeriodTable
        rows={typeRows.map((t) => ({ key: t, label: t, cells: byType.g[t], jobs: byType.jobs[t] }))}
        periods={periods}
      />

      <h2 className="text-base font-semibold mb-2 mt-6">Who Brings In Each Job Type · {scope}</h2>
      <div className="bg-card rounded-lg shadow-sm overflow-x-auto mb-2">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th>Person</Th>
              {BUSINESS_UNITS.map((t) => <Th key={t} right>{t}</Th>)}
              <Th right>Total</Th>
            </tr>
          </thead>
          <tbody>
            {personRows.length === 0 ? (
              <tr><td colSpan={BUSINESS_UNITS.length + 2} className="text-center text-muted py-4">No revenue in this period</td></tr>
            ) : personRows.map((r) => (
              <tr key={r}>
                <Td muted={r === UNASSIGNED}>{nameOf(r)}</Td>
                {BUSINESS_UNITS.map((t) => <Td key={t} right>{mix[r]?.[t] ? formatMoney(mix[r][t]) : "—"}</Td>)}
                <Td right bold>{formatMoney(rowTotal(mix[r] || {}))}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted mt-3">
        Revenue is each project&apos;s invoice amount, counted in the month of its start / install date.
        {undated.length > 0 && ` ${undated.length} project${undated.length === 1 ? "" : "s"} with revenue but no start date (${formatMoney(undated.reduce((s, p) => s + p.invoice, 0))}) aren't counted.`}
      </p>
    </div>
  );
}

function rowTotal(cells: Record<string, number>) {
  return Object.values(cells).reduce((s, v) => s + v, 0);
}

function PeriodTable({ rows, periods }: { rows: { key: string; label: string; cells: Record<string, number>; jobs: number; muted?: boolean }[]; periods: { key: string; label: string }[] }) {
  const colTotal = (k: string) => rows.reduce((s, r) => s + (r.cells[k] || 0), 0);
  const grand = rows.reduce((s, r) => s + rowTotal(r.cells), 0);
  return (
    <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th>Name</Th>
            {periods.map((p) => <Th key={p.key} right>{p.label}</Th>)}
            <Th right>Total</Th>
            <Th right>Jobs</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={periods.length + 3} className="text-center text-muted py-4">No revenue in this period</td></tr>
          ) : (
            <>
              {rows.map((r) => (
                <tr key={r.key}>
                  <Td muted={r.muted}>{r.label}</Td>
                  {periods.map((p) => <Td key={p.key} right>{r.cells[p.key] ? formatMoney(r.cells[p.key]) : "—"}</Td>)}
                  <Td right bold>{formatMoney(rowTotal(r.cells))}</Td>
                  <Td right>{r.jobs}</Td>
                </tr>
              ))}
              <tr className="bg-background">
                <Td bold>Total</Td>
                {periods.map((p) => <Td key={p.key} right bold>{colTotal(p.key) ? formatMoney(colTotal(p.key)) : "—"}</Td>)}
                <Td right bold>{formatMoney(grand)}</Td>
                <Td right bold>{rows.reduce((s, r) => s + r.jobs, 0)}</Td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`bg-background py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted border-b border-border whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right, bold, muted }: { children: React.ReactNode; right?: boolean; bold?: boolean; muted?: boolean }) {
  return <td className={`py-2.5 px-3 border-b border-border whitespace-nowrap ${right ? "text-right" : ""} ${bold ? "font-semibold" : ""} ${muted ? "text-muted" : ""}`}>{children}</td>;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
      <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

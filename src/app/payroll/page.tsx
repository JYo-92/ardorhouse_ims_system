"use client";

import { useState, useCallback } from "react";
import { usePayroll, savePayrollWeek } from "@/hooks/use-payroll";
import { useToast } from "@/components/layout/toast-provider";
import { formatMoney } from "@/lib/calculations";
import { PAYROLL_ROLES, DAY_LABELS } from "@/lib/constants";
import type { PayrollEntry } from "@/lib/types";

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

export default function PayrollPage() {
  const { payroll, mutate } = usePayroll();
  const { toast } = useToast();
  const [week, setWeek] = useState(getMonday());

  const entries: PayrollEntry[] = payroll[week] || [];

  const saveEntries = useCallback(
    async (updated: PayrollEntry[]) => {
      await savePayrollWeek(week, updated);
      await mutate();
    },
    [week, mutate]
  );

  async function addLaborer() {
    if (!week) {
      toast("Select a week", "error");
      return;
    }
    const updated = [...entries, { name: "", role: "Stager", days: [0, 0, 0, 0, 0, 0, 0], rate: 20 }];
    await saveEntries(updated);
  }

  async function updateEntry(idx: number, field: string, value: string | number) {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [field]: value };
    await saveEntries(updated);
  }

  async function updateDay(idx: number, dayIdx: number, value: number) {
    const updated = [...entries];
    const days = [...updated[idx].days];
    days[dayIdx] = value;
    updated[idx] = { ...updated[idx], days };
    await saveEntries(updated);
  }

  async function removeEntry(idx: number) {
    const updated = [...entries];
    updated.splice(idx, 1);
    await saveEntries(updated);
    toast("Laborer removed");
  }

  const totalHours = entries.reduce((sum, e) => sum + e.days.reduce((a, b) => a + b, 0), 0);
  const totalPay = entries.reduce((sum, e) => sum + e.days.reduce((a, b) => a + b, 0) * e.rate, 0);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5">Weekly Payroll</h1>

      <div className="max-w-[300px] mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted">Week Starting</label>
          <input
            type="date"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            className="py-2 px-2.5 border border-border rounded-lg text-sm bg-card focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2.5 mb-4">
        <h2 className="text-base font-semibold">Laborers</h2>
        <button onClick={addLaborer} className="inline-flex items-center gap-1.5 py-2 px-4 border-none rounded-lg text-sm font-semibold cursor-pointer bg-accent text-white hover:bg-accent2 transition-colors">
          + Add Laborer
        </button>
      </div>

      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {entries.length === 0 ? (
          <div className="py-12 px-5 text-center text-muted">
            <div className="text-3xl">💰</div>
            <p className="mt-1.5 text-sm">No laborers added for this week.</p>
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
                <th className="bg-background py-2.5 px-3 text-center font-semibold text-xs uppercase tracking-wider text-muted border-b border-border w-[80px]">Rate</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Hrs</th>
                <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Pay</th>
                <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const hrs = e.days.reduce((a, b) => a + b, 0);
                const pay = hrs * e.rate;
                return (
                  <tr key={i} className="hover:bg-[#f9fafb]">
                    <td className="py-2 px-3 border-b border-border">
                      <input value={e.name} onChange={(ev) => updateEntry(i, "name", ev.target.value)} placeholder="Name" className="w-full py-1.5 px-2 border border-border rounded text-sm" />
                    </td>
                    <td className="py-2 px-3 border-b border-border">
                      <select value={e.role} onChange={(ev) => updateEntry(i, "role", ev.target.value)} className="py-1.5 px-2 border border-border rounded text-sm">
                        {PAYROLL_ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    {e.days.map((d, di) => (
                      <td key={di} className="py-2 px-1 border-b border-border">
                        <input type="number" min={0} max={24} step={0.5} value={d} onChange={(ev) => updateDay(i, di, parseFloat(ev.target.value) || 0)} className="w-14 py-1.5 px-1 border border-border rounded text-sm text-center" />
                      </td>
                    ))}
                    <td className="py-2 px-1 border-b border-border">
                      <input type="number" min={0} step={0.01} value={e.rate} onChange={(ev) => updateEntry(i, "rate", parseFloat(ev.target.value) || 0)} className="w-20 py-1.5 px-1 border border-border rounded text-sm text-center" />
                    </td>
                    <td className="py-2 px-3 border-b border-border text-right font-semibold">{hrs.toFixed(1)}</td>
                    <td className="py-2 px-3 border-b border-border text-right font-semibold">{formatMoney(pay)}</td>
                    <td className="py-2 px-3 border-b border-border">
                      <button onClick={() => removeEntry(i)} className="py-1 px-2 text-xs font-semibold rounded bg-red text-white border-none cursor-pointer">Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {entries.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mt-4">
          <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
            <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">Total Hours</div>
            <div className="text-2xl font-bold">{totalHours.toFixed(1)}</div>
          </div>
          <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
            <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">Total Pay</div>
            <div className="text-2xl font-bold text-green">{formatMoney(totalPay)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

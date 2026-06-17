"use client";

import { useState, useMemo } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useProfile } from "@/hooks/use-profile";
import { useInventory } from "@/hooks/use-inventory";
import { useToast } from "@/components/layout/toast-provider";
import { formatMoney, formatPercent, projCalc, getAvail, getStaged } from "@/lib/calculations";
import { downloadCSV } from "@/lib/csv";

type ReportType = "pnl" | "usage" | "popular" | "out" | "avail" | "history";

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "pnl", label: "Per-Job P&L Summary" },
  { value: "usage", label: "Inventory Usage by Project" },
  { value: "popular", label: "Most Used Furniture Items" },
  { value: "out", label: "Inventory Out for Staging" },
  { value: "avail", label: "Inventory Available in Warehouse" },
  { value: "history", label: "Project Staging History" },
];

export default function ReportsPage() {
  const { projects } = useProjects();
  const { isSuperAdmin, isLoading: profileLoading } = useProfile();
  const { inventory } = useInventory();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>("pnl");

  const { headers, rows } = useMemo(() => {
    switch (reportType) {
      case "pnl": {
        const h = ["Project", "Business Unit", "Invoice", "Total Cost", "Gross Profit", "Margin %"];
        const r = projects.map((p) => {
          const c = projCalc(p, inventory);
          return [p.name, p.bu, c.invoice, c.totalCost, c.profit, Number(c.margin.toFixed(1))];
        });
        return { headers: h, rows: r };
      }
      case "usage": {
        const h = ["Project", "Room", "Item", "Category", "Size", "Qty"];
        const r: (string | number)[][] = [];
        projects.forEach((p) => {
          if (p.rooms) {
            Object.entries(p.rooms).forEach(([rm, items]) => {
              (items || []).forEach((a) => {
                const it = inventory.find((i) => i.id === a.itemId);
                if (it) r.push([p.name, rm, it.name, it.category, it.size || "", a.qty]);
              });
            });
          }
        });
        return { headers: h, rows: r };
      }
      case "popular": {
        const freq: Record<string, number> = {};
        projects.forEach((p) => {
          if (p.rooms) {
            Object.values(p.rooms).forEach((items) => {
              (items || []).forEach((a) => { freq[a.itemId] = (freq[a.itemId] || 0) + a.qty; });
            });
          }
        });
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const h = ["Item", "Category", "Times Assigned"];
        const r: (string | number)[][] = [];
        sorted.forEach(([id, count]) => {
          const it = inventory.find((i) => i.id === id);
          if (it) r.push([it.name, it.category, count]);
        });
        return { headers: h, rows: r };
      }
      case "out": {
        const h = ["Item", "Category", "Size", "Qty Staged", "Project(s)"];
        const r: (string | number)[][] = [];
        inventory.forEach((i) => {
          const st = getStaged(i.id, projects);
          if (st > 0) {
            const prjs: string[] = [];
            projects.forEach((p) => {
              if (p.rooms) {
                Object.values(p.rooms).forEach((items) => {
                  (items || []).forEach((a) => { if (a.itemId === i.id) prjs.push(p.name); });
                });
              }
            });
            r.push([i.name, i.category, i.size || "", st, [...new Set(prjs)].join(", ")]);
          }
        });
        return { headers: h, rows: r };
      }
      case "avail": {
        const h = ["Item", "Category", "Size", "Available", "Total"];
        const r: (string | number)[][] = [];
        inventory.forEach((i) => {
          const a = getAvail(i.id, inventory, projects);
          if (a > 0) r.push([i.name, i.category, i.size || "", a, i.qty]);
        });
        return { headers: h, rows: r };
      }
      case "history": {
        const h = ["Project", "Status", "Start", "End", "Rooms", "Pieces"];
        const r = projects.map((p) => {
          const c = projCalc(p, inventory);
          return [p.name, p.status, p.start_date || "", p.end_date || "", Object.keys(p.rooms || {}).length, c.pieces];
        });
        return { headers: h, rows: r };
      }
    }
  }, [reportType, projects, inventory]);

  function exportCSV() {
    if (rows.length === 0) { toast("No data", "error"); return; }
    downloadCSV("ardor-report", headers, rows);
  }

  const marginBadge = (m: number) => {
    const cls = m >= 50 ? "bg-[#dcfce7] text-[#16a34a]" : m >= 30 ? "bg-[#fef9c3] text-[#ca8a04]" : "bg-[#fee2e2] text-[#dc2626]";
    return <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${cls}`}>{formatPercent(m)}</span>;
  };

  const statusBadge = (s: string) => {
    const cls = s === "Active" ? "bg-[#dcfce7] text-[#16a34a]" : s === "Scheduled" ? "bg-[#e0e7ff] text-[#4338ca]" : s === "De-stage Scheduled" ? "bg-[#fef9c3] text-[#ca8a04]" : "bg-[#f3e8ff] text-[#7c3aed]";
    return <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${cls}`}>{s}</span>;
  };

  const isMoneyCol = (h: string) => ["Invoice", "Total Cost", "Gross Profit"].includes(h);
  const isRightCol = (h: string) => ["Invoice", "Total Cost", "Gross Profit", "Margin %", "Qty", "Times Assigned", "Qty Staged", "Available", "Total", "Rooms", "Pieces"].includes(h);

  if (!profileLoading && !isSuperAdmin) {
    return (
      <div className="py-16 text-center text-muted">
        <div className="text-3xl">🔒</div>
        <p className="mt-2 text-sm">Reports are available to administrators only.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5">Reports</h1>

      <div className="flex gap-2 flex-wrap mb-5">
        <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="py-1.5 px-2.5 border border-border rounded-lg text-sm bg-card">
          {REPORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={exportCSV} className="inline-flex items-center gap-1.5 py-1.5 px-4 rounded-lg text-sm font-semibold cursor-pointer bg-card text-foreground border border-border hover:bg-background">
          ⬇ Export CSV
        </button>
      </div>

      <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-muted text-sm">No data for this report.</div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className={`bg-background py-2.5 px-3 font-semibold text-xs uppercase tracking-wider text-muted border-b border-border whitespace-nowrap ${isRightCol(h) ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-[#f9fafb]">
                  {row.map((cell, ci) => {
                    const h = headers[ci];
                    let content: React.ReactNode = String(cell);

                    if (h === "Margin %" && reportType === "pnl") content = marginBadge(Number(cell));
                    else if (h === "Gross Profit") content = <span className={`font-semibold ${Number(cell) >= 0 ? "text-green" : "text-red"}`}>{formatMoney(Number(cell))}</span>;
                    else if (isMoneyCol(h)) content = formatMoney(Number(cell));
                    else if (h === "Status" && reportType === "history") content = statusBadge(String(cell));
                    else if (h === "Times Assigned") content = <strong>{cell}</strong>;

                    return (
                      <td key={ci} className={`py-2.5 px-3 border-b border-border whitespace-nowrap ${isRightCol(h) ? "text-right" : "text-left"}`}>{content}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

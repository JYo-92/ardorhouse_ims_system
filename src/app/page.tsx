"use client";

import { useProjects, saveProjectInfo } from "@/hooks/use-projects";
import { useProfile } from "@/hooks/use-profile";
import { useInventory } from "@/hooks/use-inventory";
import { useToast } from "@/components/layout/toast-provider";
import { formatMoney, formatPercent, projCalc, getAvail, getStaged, daysUntilEnd } from "@/lib/calculations";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { projects, mutate } = useProjects();
  const { isSuperAdmin } = useProfile();
  const { inventory } = useInventory();
  const { toast } = useToast();
  const router = useRouter();

  // Money is shown to super admins and to contract owners (their own rows).
  const canSeeMoney = isSuperAdmin || projects.some((p) => p.canSeeFinancials);

  const scheduled = projects.filter((p) => p.status === "Scheduled");
  const active = projects.filter((p) => p.status === "Active");
  const destage = projects.filter((p) => p.status === "De-stage Scheduled");
  const completed = projects.filter((p) => p.status === "Completed");

  const totalItems = inventory.reduce((s, i) => s + i.qty, 0);
  let stagedCount = 0, availableCount = 0, shortages = 0;
  inventory.forEach((i) => {
    const a = getAvail(i.id, inventory, projects);
    const st = getStaged(i.id, projects);
    stagedCount += st;
    availableCount += a;
    if (a === 0 && i.qty > 0) shortages++;
  });

  let totalRev = 0, totalProfit = 0;
  const margins: number[] = [];
  projects.forEach((p) => {
    const c = projCalc(p, inventory);
    totalRev += c.invoice;
    totalProfit += c.profit;
    if (c.invoice > 0) margins.push(c.margin);
  });
  const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
  const mc = avgMargin >= 50 ? "text-green" : avgMargin >= 30 ? "text-yellow" : "text-red";

  const alerts = projects.filter((p) => {
    const d = daysUntilEnd(p);
    return d >= 0 && d <= 7 && p.status !== "Completed";
  });

  async function quickStatus(pid: string, newStatus: string) {
    const p = projects.find((x) => x.id === pid);
    if (!p) return;
    await saveProjectInfo({ ...p, status: newStatus });
    await mutate();
    toast(`${p.name} → ${newStatus}`);
  }

  const marginBadge = (m: number) => {
    const cls = m >= 50 ? "bg-[#dcfce7] text-[#16a34a]" : m >= 30 ? "bg-[#fef9c3] text-[#ca8a04]" : "bg-[#fee2e2] text-[#dc2626]";
    return <span className={`inline-block py-0.5 px-2 rounded-full text-xs font-semibold ${cls}`}>{formatPercent(m)}</span>;
  };

  const ProjectTable = ({ items, showProfit, actionLabel, actionStatus, showAction = true }: { items: typeof projects; showProfit: boolean; actionLabel?: string; actionStatus?: string; showAction?: boolean }) => {
    const moneyCols = canSeeMoney; // Invoice column
    const profitCols = canSeeMoney && showProfit; // Profit + Margin columns
    const baseCols = 3 + (moneyCols ? 1 : 0) + (profitCols ? 2 : 0) + (showAction ? 1 : 0);
    return (
    <div className="bg-card rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Project</th>
            <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Business Unit</th>
            <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">{showProfit ? "End Date" : "Start Date"}</th>
            {moneyCols && <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Invoice</th>}
            {profitCols && <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Profit</th>}
            {profitCols && <th className="bg-background py-2.5 px-3 text-right font-semibold text-xs uppercase tracking-wider text-muted border-b border-border">Margin</th>}
            {showAction && <th className="bg-background py-2.5 px-3 text-left font-semibold text-xs uppercase tracking-wider text-muted border-b border-border"></th>}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={baseCols} className="text-center text-muted py-4">No projects</td></tr>
          ) : (
            items.map((p) => {
              const c = projCalc(p, inventory);
              const canSee = isSuperAdmin || p.canSeeFinancials;
              return (
                <tr key={p.id} className="hover:bg-[#f9fafb] cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                  <td className="py-2.5 px-3 border-b border-border">
                    <strong>{p.name}</strong>
                    {p.address && <><br /><span className="text-muted text-xs">{p.address}</span></>}
                  </td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{p.bu}</td>
                  <td className="py-2.5 px-3 border-b border-border whitespace-nowrap">{showProfit ? (p.end_date || "—") : (p.start_date || "—")}</td>
                  {moneyCols && <td className="py-2.5 px-3 border-b border-border text-right whitespace-nowrap">{canSee ? formatMoney(c.invoice) : "—"}</td>}
                  {profitCols && <td className={`py-2.5 px-3 border-b border-border text-right font-semibold whitespace-nowrap ${canSee && c.profit < 0 ? "text-red" : canSee ? "text-green" : ""}`}>{canSee ? formatMoney(c.profit) : "—"}</td>}
                  {profitCols && <td className="py-2.5 px-3 border-b border-border text-right whitespace-nowrap">{canSee ? marginBadge(c.margin) : "—"}</td>}
                  {showAction && actionLabel && actionStatus && (
                    <td className="py-2.5 px-3 border-b border-border whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => quickStatus(p.id, actionStatus)} className={`py-1 px-2.5 text-xs font-semibold rounded-lg border-none cursor-pointer text-white ${actionStatus === "Active" || actionStatus === "Completed" ? "bg-green hover:bg-[#15803d]" : "bg-[#fef9c3] !text-[#ca8a04]"}`}>
                        {actionLabel}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    );
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-5">Dashboard</h1>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mb-6">
        <Card label="Scheduled" value={scheduled.length} />
        <Card label="Active" value={active.length} color="text-green" />
        <Card label="De-stage" value={destage.length} color="text-yellow" />
        <Card label="Completed" value={completed.length} />
        <Card label="Total Inventory" value={totalItems} />
        <Card label="Items Staged" value={stagedCount} />
        <Card label="Shortages" value={shortages} color={shortages > 0 ? "text-red" : undefined} />
        {canSeeMoney && <Card label="Total Revenue" value={formatMoney(totalRev)} />}
        {canSeeMoney && <Card label="Total Profit" value={formatMoney(totalProfit)} color={totalProfit >= 0 ? "text-green" : "text-red"} />}
        {canSeeMoney && <Card label="Avg Margin" value={margins.length ? formatPercent(avgMargin) : "—"} color={mc} />}
      </div>

      {alerts.length > 0 && (
        <div className="mb-4">
          {alerts.map((p) => (
            <div key={p.id} className="bg-[#fef9c3] border border-[#fde68a] rounded-lg py-2.5 px-3.5 mb-2 text-sm flex justify-between items-center">
              <span>⚠ <strong>{p.name}</strong> ends {p.end_date} ({daysUntilEnd(p)} days)</span>
              <button onClick={() => router.push(`/projects/${p.id}`)} className="py-1 px-2.5 text-xs font-semibold rounded-lg bg-card text-foreground border border-border cursor-pointer">View</button>
            </div>
          ))}
        </div>
      )}

      <Section title="Scheduled Projects"><ProjectTable items={scheduled} showProfit={false} actionLabel="Mark Active" actionStatus="Active" /></Section>
      <Section title="Active Projects"><ProjectTable items={active} showProfit={true} actionLabel="De-stage" actionStatus="De-stage Scheduled" /></Section>
      <Section title="De-stage Scheduled"><ProjectTable items={destage} showProfit={true} actionLabel="Complete" actionStatus="Completed" /></Section>
      <Section title="Completed Projects"><ProjectTable items={completed} showProfit={true} showAction={false} /></Section>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-card rounded-lg py-4 px-5 shadow-sm">
      <div className="text-[.7rem] text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}

import type { Project, InventoryItem, ProjectCalc } from "./types";

export function formatMoney(n: number): string {
  return (
    "$" +
    Number(n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatPercent(n: number): string {
  return (n || 0).toFixed(1) + "%";
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getStaged(
  itemId: string,
  projects: Project[]
): number {
  let staged = 0;
  projects.forEach((p) => {
    if (p.rooms) {
      Object.values(p.rooms).forEach((rm) => {
        (rm || []).forEach((a) => {
          if (a.itemId === itemId) staged += a.qty;
        });
      });
    }
  });
  return staged;
}

export function getAvail(
  itemId: string,
  inventory: InventoryItem[],
  projects: Project[]
): number {
  const item = inventory.find((i) => i.id === itemId);
  if (!item) return 0;
  return Math.max(0, item.qty - getStaged(itemId, projects));
}

export function getItemStatus(
  item: InventoryItem,
  projects: Project[]
): string {
  const staged = getStaged(item.id, projects);
  if (staged >= item.qty) return "Out for Staging";
  if (staged > 0) return "Partial - Out for Staging";
  if (item.status === "Reserved") return "Reserved";
  return "In Warehouse";
}

export function projCalc(
  p: Project,
  inventory: InventoryItem[]
): ProjectCalc {
  let totalLabor = 0;
  let totalMisc = 0;
  let totalInvCost = 0;
  let pieces = 0;

  (p.labor || []).forEach((l) => {
    totalLabor += (l.workers || 0) * (l.hours || 0) * (l.rate || 0);
  });

  const totalLog = (p.log_runs || 0) * (p.log_miles || 0) * (p.log_cpm || 0.67);
  const totalStor = (p.stor_pulls || 0) * (p.stor_cpp || 0);

  (p.misc_lines || []).forEach((m) => {
    totalMisc += m.amount || 0;
  });

  if (p.rooms) {
    Object.values(p.rooms).forEach((rm) => {
      (rm || []).forEach((a) => {
        pieces += a.qty;
        const it = inventory.find((i) => i.id === a.itemId);
        if (it) totalInvCost += a.qty * (it.cost || 0);
      });
    });
  }

  const totalCost = totalLabor + totalLog + totalStor + totalMisc + totalInvCost;
  const invoice = p.invoice || 0;
  const profit = invoice - totalCost;
  const margin = invoice > 0 ? (profit / invoice) * 100 : 0;
  const laborPct = invoice > 0 ? (totalLabor / invoice) * 100 : 0;
  const cpp = pieces > 0 ? totalCost / pieces : 0;
  const balance = invoice - (p.deposit || 0);

  return {
    totalLabor,
    totalLog,
    totalStor,
    totalMisc,
    totalInvCost,
    totalCost,
    invoice,
    profit,
    margin,
    laborPct,
    cpp,
    balance,
    pieces,
  };
}

export function daysUntilEnd(p: Project): number {
  if (!p.end_date) return 999;
  return Math.ceil(
    (new Date(p.end_date).getTime() - new Date().getTime()) / 86400000
  );
}

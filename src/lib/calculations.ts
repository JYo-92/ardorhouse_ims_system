import type { Project, InventoryItem, ProjectCalc, LaborEntry } from "./types";

export function getLaborHours(l: LaborEntry): number {
  if (l.start_time && l.end_time) {
    const [sh, sm] = l.start_time.split(":").map(Number);
    const [eh, em] = l.end_time.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins / 60;
  }
  return l.hours || 0;
}

export function getLaborCost(l: LaborEntry): number {
  return getLaborHours(l) * (l.rate || 0);
}

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

export function getStagedByProject(
  itemId: string,
  projects: Project[]
): { projectId: string; projectName: string; qty: number }[] {
  const out: { projectId: string; projectName: string; qty: number }[] = [];
  projects.forEach((p) => {
    if (!p.rooms) return;
    let qty = 0;
    Object.values(p.rooms).forEach((rm) => {
      (rm || []).forEach((a) => {
        if (a.itemId === itemId) qty += a.qty;
      });
    });
    if (qty > 0) out.push({ projectId: p.id, projectName: p.name, qty });
  });
  return out;
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
    totalLabor += getLaborCost(l);
  });

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

  const totalCost = totalLabor + totalMisc + totalInvCost;
  const invoice = p.invoice || 0;
  const profit = invoice - totalCost;
  const margin = invoice > 0 ? (profit / invoice) * 100 : 0;
  const laborPct = invoice > 0 ? (totalLabor / invoice) * 100 : 0;
  const cpp = pieces > 0 ? totalCost / pieces : 0;
  const balance = invoice - (p.deposit || 0);

  return {
    totalLabor,
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

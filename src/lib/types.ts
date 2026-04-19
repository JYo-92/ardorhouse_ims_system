export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  size: string | null;
  qty: number;
  cost: number;
  status: string;
  notes: string | null;
  images: string[];
  location_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  address: string | null;
  bu: string;
  agent: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  status: string;
  invoice: number;
  deposit: number;
  rooms: Record<string, RoomAssignment[]>;
  labor: LaborEntry[];
  misc_lines: MiscLine[];
  created_at?: string;
  updated_at?: string;
}

export interface RoomAssignment {
  itemId: string;
  qty: number;
}

export interface LaborEntry {
  name?: string;
  role: string;
  start_time?: string;
  end_time?: string;
  rate: number;
  hours?: number;
}

export interface MiscLine {
  desc: string;
  amount: number;
}

export interface PayrollWeek {
  id: string;
  week_start: string;
  entries: PayrollEntry[];
  created_at?: string;
  updated_at?: string;
}

export interface PayrollEntry {
  name: string;
  role: string;
  days: number[];
  rate: number;
}

export interface ProjectCalc {
  totalLabor: number;
  totalMisc: number;
  totalInvCost: number;
  totalCost: number;
  invoice: number;
  profit: number;
  margin: number;
  laborPct: number;
  cpp: number;
  balance: number;
  pieces: number;
}

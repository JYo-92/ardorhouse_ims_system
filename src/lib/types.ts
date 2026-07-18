export type Role = "super_admin" | "manager" | "user" | "installer";

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  job_type: LaborType;
  clock_in: string;
  clock_out: string | null;
  created_at?: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title?: string | null;
  role: Role;
  created_at?: string;
  updated_at?: string;
}

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
  rooms: Record<string, RoomAssignment[]>;
  // --- Financial fields live in project_financials (RLS-protected). They are
  // populated only when the current user is a super admin or the project's
  // contract owner; otherwise they are zero/empty and canSeeFinancials=false. ---
  canSeeFinancials: boolean;
  invoice: number;
  deposit: number;
  contract_value: number;
  contract_owner_id: string | null;
  labor: LaborEntry[];
  misc_lines: MiscLine[];
  created_at?: string;
  updated_at?: string;
}

/** Shape of a row in the project_financials table. */
export interface ProjectFinancials {
  project_id: string;
  invoice: number;
  deposit: number;
  contract_value: number;
  labor: LaborEntry[];
  misc_lines: MiscLine[];
  contract_owner_id: string | null;
}

export interface RoomAssignment {
  itemId: string;
  qty: number;
}

export type LaborType = "Staging" | "De-staging";

export interface LaborEntry {
  id?: string;
  name?: string;
  role: string;
  type?: LaborType;
  date?: string;
  start_time?: string;
  end_time?: string;
  rate?: number;
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
  laborStaging: number;
  laborDestaging: number;
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

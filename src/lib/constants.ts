export const CATEGORIES = [
  "Sofa",
  "Coffee Table",
  "Accent Chair",
  "Rug",
  "Side Table",
  "Dining Table",
  "Dining Chair",
  "Bed Frame",
  "Nightstand",
  "Bench",
  "Ottoman",
  "Mattress",
  "Counter Chairs",
  "Console",
  "Sideboard",
  "Outdoor Seating Set",
  "Outdoor Dining Set",
  "Office Desk",
  "Office Chair",
] as const;

export const SIZES: Record<string, string[]> = {
  "Bed Frame": ["Twin", "Full", "Queen", "King"],
  Mattress: ["Twin", "Full", "Queen", "King"],
  Rug: ["5x7", "8x10", "10x14", "Round", "Cowhide"],
};

export const ROOMS = [
  "Living Room",
  "Dining Room",
  "Kitchen",
  "Master Bedroom",
  "Bedroom 1",
  "Bedroom 2",
  "Bedroom 3",
  "Office",
  "Outdoor",
  "Other",
] as const;

export const LABOR_ROLES = ["Stager", "Mover"] as const;

export const LABOR_TYPES = ["Staging", "De-staging"] as const;

/** Job types. Stored in projects.bu (the column predates the rename). */
export const BUSINESS_UNITS = [
  "Staging",
  "Furnishing",
  "Interior Design",
  "Junk Removal",
] as const;
export type JobType = (typeof BUSINESS_UNITS)[number];

/** A job-type-specific field, stored under its key in projects.details.
 *  Never put money here — designers can read projects. Revenue and costs live
 *  in project_financials. */
export interface JobField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
}

export const JOB_TYPE_FIELDS: Record<JobType, JobField[]> = {
  Staging: [],
  Furnishing: [
    { key: "furnishing_type", label: "Furnishing Type", type: "select", options: ["Purchase for client", "Rental"] },
    { key: "property_type", label: "Property Type", type: "select", options: ["Vacation rental", "Primary home", "Office", "Other"] },
    { key: "rooms_count", label: "Rooms to Furnish", type: "number" },
    { key: "style_notes", label: "Style Notes", type: "textarea" },
  ],
  "Interior Design": [
    { key: "service", label: "Service", type: "select", options: ["Full-service design", "Consultation", "E-design", "Remodel / renovation"] },
    { key: "fee_type", label: "Fee Type", type: "select", options: ["Flat fee", "Hourly"] },
    { key: "est_hours", label: "Estimated Hours", type: "number" },
    { key: "rooms_scope", label: "Rooms in Scope", type: "text" },
    { key: "style_notes", label: "Style Notes", type: "textarea" },
  ],
  "Junk Removal": [
    { key: "load_size", label: "Load Size", type: "select", options: ["Single item", "Quarter truck", "Half truck", "Full truck", "Multiple trucks"] },
    { key: "loads", label: "Number of Loads", type: "number" },
    { key: "items", label: "Items to Remove", type: "textarea" },
    { key: "access_notes", label: "Access Notes (stairs, parking…)", type: "text" },
  ],
};

/** Job types that pull furniture from inventory (Rooms & Furniture tab). */
export const FURNITURE_JOB_TYPES: string[] = ["Staging", "Furnishing"];

/** Only staging runs on a 90-day term and gets de-staged. */
export function statusesFor(jobType: string): readonly string[] {
  return jobType === "Staging" || !jobType
    ? PROJECT_STATUSES
    : PROJECT_STATUSES.filter((s) => s !== "De-stage Scheduled");
}

export const PAYROLL_ROLES = ["Lead Stager", "Stager", "Driver/Installer"] as const;

export const PROJECT_STATUSES = [
  "Scheduled",
  "Active",
  "De-stage Scheduled",
  "Completed",
] as const;

export const INVENTORY_STATUSES = [
  "In Warehouse",
  "Out for Staging",
  "Reserved",
  "Scheduled for De-staging",
] as const;

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

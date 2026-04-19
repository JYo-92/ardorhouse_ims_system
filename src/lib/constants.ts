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

export const BUSINESS_UNITS = [
  "Staging",
  "Interior Design",
  "Vacation Rental Design",
  "Furniture Rental",
] as const;

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

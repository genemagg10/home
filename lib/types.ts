export type DueStatus = "overdue" | "soon" | "ok" | "unknown";

export interface House {
  id: string;
  name: string;
  address: string | null;
  year_built: number | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  lat: number | null;
  lon: number | null;
  trash_day: string | null;
  recycle_day: string | null;
}

// Additional buildings on the property (e.g. a backyard cottage / ADU). The
// Main House stays the houses row; items with no structure_id belong to it.
export interface Structure {
  id: string;
  name: string;
  kind: string | null;
  sqft: number | null;
  beds: number | null;
  baths: number | null;
  notes: string | null;
  emoji: string;
  sort: number;
}

export interface MaintenanceItem {
  id: string;
  title: string;
  detail: string | null;
  category: string;
  interval_days: number | null;
  last_done: string | null;
  emoji: string;
  due_date: string | null;
  status: DueStatus;
  days_remaining: number | null;
  structure_id: string | null;
}

export interface SeasonalTask {
  id: string;
  title: string;
  detail: string | null;
  start_month: number;
  end_month: number;
  emoji: string;
  structure_id: string | null;
}

export interface Project {
  id: string;
  title: string;
  status: string;
  percent: number;
  next_step: string | null;
  budget_cents: number | null;
  contractor: string | null;
  tags: string[];
  structure_id: string | null;
}

export interface Vital {
  id: string;
  label: string;
  value: string;
  is_sensitive: boolean;
  sort: number;
  structure_id: string | null;
}

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  role: string | null;
  note: string | null;
  sitter_safe: boolean;
}

export interface Paint {
  id: string;
  room: string;
  color_name: string;
  brand: string | null;
  sheen: string | null;
  hex: string | null;
  structure_id: string | null;
}

// Lightweight, day-of-week recurring reminders shown in a contextual ticker.
export interface Routine {
  id: string;
  title: string;
  detail: string | null;
  emoji: string;
  days_of_week: number[]; // 0=Sun … 6=Sat
  time_of_day: string | null;
  sort: number;
}

export type ApplianceStatus = "ok" | "service" | "replace";

export interface Appliance {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  location: string | null;
  purchased: string | null;
  warranty_until: string | null;
  status: ApplianceStatus;
  notes: string | null;
  emoji: string;
  structure_id: string | null;
}

// Shape Claude proposes for an appliance from a forwarded purchase email.
export interface SuggestedAppliance {
  name: string;
  brand?: string;
  model?: string;
  serial?: string;
  purchased?: string;
  warranty_until?: string;
  notes?: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  kind: "pdf" | "image" | "link" | "note";
  source_url: string | null;
  ai_summary: string | null;
  ai_category: string | null;
  ai_tags: string[];
  ai_suggested_task: { title: string; interval_days?: number; detail?: string } | null;
  ai_suggested_appliance: SuggestedAppliance | null;
  status: "pending" | "published" | "rejected";
  created_at: string;
  file_url?: string | null; // signed URL for a stored attachment (pdf/image)
}

export interface Weather {
  tempF: number | null;
  code: number | null;
  summary: string;
  high: number | null;
  low: number | null;
  freezeWarning: boolean;
  heatWarning: boolean;
}

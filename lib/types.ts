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
}

export interface SeasonalTask {
  id: string;
  title: string;
  detail: string | null;
  start_month: number;
  end_month: number;
  emoji: string;
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
}

export interface Vital {
  id: string;
  label: string;
  value: string;
  is_sensitive: boolean;
  sort: number;
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
  status: "pending" | "published" | "rejected";
  created_at: string;
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

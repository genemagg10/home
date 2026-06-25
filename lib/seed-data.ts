import type {
  House, MaintenanceItem, SeasonalTask, Project, Vital, Contact, Paint,
} from "./types";

// Sample "Maple Street House" data — mirrors the approved mockup so the app
// renders meaningfully before Supabase is connected. Also seeded via supabase/seed.sql.
export const seedHouse: House = {
  id: "seed", name: "The Maple Street House", address: "1847 Maple St",
  year_built: 1996, sqft: 2340, beds: 4, baths: 2.5,
  lat: 39.7684, lon: -86.1581, trash_day: "Tuesday", recycle_day: "alternate Friday",
};

export const seedMaintenance: MaintenanceItem[] = [
  { id: "1", title: "HVAC filter — main unit", detail: "20×25×1 MERV 11 · 2 spares in basement", category: "replacement", interval_days: 90, last_done: null, emoji: "⚠️", due_date: null, status: "overdue", days_remaining: -14 },
  { id: "2", title: "Fridge water filter", detail: "LG LT1000P · order link saved", category: "replacement", interval_days: 180, last_done: null, emoji: "💧", due_date: null, status: "overdue", days_remaining: -9 },
  { id: "3", title: "Detector batteries", detail: "9V ×5 · annual swap", category: "replacement", interval_days: 365, last_done: null, emoji: "🔋", due_date: null, status: "soon", days_remaining: 22 },
  { id: "4", title: "Water softener salt", detail: "40lb pellets", category: "replacement", interval_days: 60, last_done: null, emoji: "🧂", due_date: null, status: "soon", days_remaining: 26 },
  { id: "5", title: "Furnace humidifier pad", detail: "Aprilaire #35", category: "replacement", interval_days: 365, last_done: null, emoji: "✓", due_date: null, status: "ok", days_remaining: 140 },
];

export const seedSeasonal: SeasonalTask[] = [
  { id: "1", title: "Service the AC condenser", detail: "rinse coils, check the refrigerant", start_month: 6, end_month: 6, emoji: "❄️" },
  { id: "2", title: "Reverse ceiling fans", detail: "counter-clockwise for summer · all 4", start_month: 6, end_month: 6, emoji: "🌀" },
  { id: "3", title: "Reseal the deck", detail: "Cabot Honey Teak · ¾ can in shed", start_month: 6, end_month: 7, emoji: "🪵" },
  { id: "4", title: "Fertilize the lawn", detail: "Scotts Step 2", start_month: 7, end_month: 7, emoji: "🌱" },
  { id: "5", title: "Gutter cleaning", detail: "upcoming this fall", start_month: 10, end_month: 10, emoji: "🍂" },
];

export const seedProjects: Project[] = [
  { id: "1", title: "Primary bathroom remodel", status: "active", percent: 62, next_step: "Vanity install Thursday, waiting on the quartz top.", budget_cents: 1420000, contractor: "Reyes Tile & Bath", tags: ["8 receipts"] },
  { id: "2", title: "Backyard French drain", status: "active", percent: 30, next_step: "Rent the trencher this weekend.", budget_cents: null, contractor: null, tags: ["DIY", "permit on file", "gravel delivered"] },
  { id: "3", title: "Repaint exterior trim", status: "active", percent: 90, next_step: "Final coat on the garage door.", budget_cents: null, contractor: null, tags: ["SW Tricorn Black", "paint in shed"] },
];

export const seedVitals: Vital[] = [
  { id: "1", label: "Water shutoff", value: "Basement, NW corner behind the softener", is_sensitive: false, sort: 0 },
  { id: "2", label: "Gas shutoff", value: "At the meter, east side", is_sensitive: false, sort: 1 },
  { id: "3", label: "Breaker panel", value: "Garage — photo-mapped, 24 circuits", is_sensitive: false, sort: 2 },
  { id: "4", label: "Trash & recycle", value: "Trash Tue · Recycle alt-Friday", is_sensitive: false, sort: 3 },
  { id: "5", label: "Furnace filter", value: "20 × 25 × 1", is_sensitive: false, sort: 4 },
  { id: "6", label: "Wi-Fi", value: "MapleNet · password in vault", is_sensitive: true, sort: 5 },
];

export const seedContacts: Contact[] = [
  { id: "1", name: "Reyes Tile & Bath", phone: "(555) 204-8831", role: "Tile/Bath", note: "current remodel", sitter_safe: false },
  { id: "2", name: "Hank — Plumber", phone: "(555) 661-2090", role: "Plumber", note: "knows the house", sitter_safe: true },
  { id: "3", name: "ComfortAir HVAC", phone: "(555) 880-1145", role: "HVAC", note: "service contract", sitter_safe: true },
  { id: "4", name: "Dr. Green Lawn", phone: "(555) 332-0091", role: "Lawn", note: "quarterly", sitter_safe: true },
];

export const seedPaints: Paint[] = [
  { id: "1", room: "Exterior trim", color_name: "Tricorn Black", brand: "SW", sheen: "satin", hex: "#2b2b2e" },
  { id: "2", room: "Living room", color_name: "Edgecomb Gray", brand: "BM", sheen: "eggshell", hex: "#d8d2c4" },
  { id: "3", room: "Primary bath", color_name: "Ripe Olive", brand: "SW", sheen: "matte", hex: "#3f5a52" },
  { id: "4", room: "Kitchen & halls", color_name: "White Dove", brand: "BM", sheen: "eggshell", hex: "#f3efe6" },
];

import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";
import * as seed from "./seed-data";
import type {
  House, MaintenanceItem, SeasonalTask, Project, Vital, Contact, Paint, DocumentRow,
} from "./types";

// Loads everything the dashboard needs. If Supabase isn't configured yet, it
// transparently falls back to the seed sample so the UI is never empty.
export interface DashboardData {
  usingSeed: boolean;
  house: House;
  maintenance: MaintenanceItem[];
  seasonal: SeasonalTask[];
  projects: Project[];
  vitals: Vital[];
  contacts: Contact[];
  paints: Paint[];
  pendingCount: number;
}

// Exported so the client can compute "is this in season now?" for the Year-view
// toggle without another round trip.
export const monthInSeason = (s: SeasonalTask, m: number) =>
  s.start_month <= s.end_month
    ? m >= s.start_month && m <= s.end_month
    : m >= s.start_month || m <= s.end_month;

export async function getDashboardData(): Promise<DashboardData> {
  noStore(); // never serve a cached snapshot — edits must show up immediately
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      usingSeed: true,
      house: seed.seedHouse,
      maintenance: seed.seedMaintenance,
      seasonal: seed.seedSeasonal,
      projects: seed.seedProjects,
      vitals: seed.seedVitals,
      contacts: seed.seedContacts,
      paints: seed.seedPaints,
      pendingCount: 3,
    };
  }

  const db = supabaseAdmin();
  const [house, maint, seasonal, projects, vitals, contacts, paints, pending] =
    await Promise.all([
      db.from("houses").select("*").limit(1).single(),
      db.from("maintenance_due").select("*").order("days_remaining", { ascending: true }),
      db.from("seasonal_tasks").select("*").order("start_month"),
      db.from("projects").select("*").order("created_at", { ascending: false }),
      db.from("vitals").select("*").order("sort"),
      db.from("contacts").select("*"),
      db.from("paints").select("*"),
      db.from("documents").select("id").eq("status", "pending"),
    ]);

  return {
    usingSeed: false,
    house: (house.data as House) ?? seed.seedHouse,
    maintenance: (maint.data as MaintenanceItem[]) ?? [],
    // Return the full set; the client filters to "this season" vs "all year".
    seasonal: (seasonal.data as SeasonalTask[]) ?? [],
    projects: (projects.data as Project[]) ?? [],
    vitals: (vitals.data as Vital[]) ?? [],
    contacts: (contacts.data as Contact[]) ?? [],
    paints: (paints.data as Paint[]) ?? [],
    pendingCount: pending.data?.length ?? 0,
  };
}

export async function getPendingDocuments(): Promise<DocumentRow[]> {
  noStore();
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const db = supabaseAdmin();
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return (data as DocumentRow[]) ?? [];
}

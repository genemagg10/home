import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

// Generic, allowlisted CRUD for the dashboard's "Manage" mode. The browser never
// holds the service role key — every insert/update/delete comes through here and
// is constrained to known tables and columns. Computed views (maintenance_due)
// are intentionally absent: edits target the underlying maintenance_items table.
const COLUMNS: Record<string, string[]> = {
  houses: ["name", "address", "year_built", "sqft", "beds", "baths", "lat", "lon", "trash_day", "recycle_day"],
  structures: ["name", "kind", "sqft", "beds", "baths", "notes", "emoji", "sort"],
  maintenance_items: ["title", "detail", "category", "interval_days", "last_done", "emoji", "structure_id"],
  seasonal_tasks: ["title", "detail", "start_month", "end_month", "emoji", "structure_id"],
  projects: ["title", "status", "percent", "next_step", "budget_cents", "contractor", "tags", "structure_id"],
  vitals: ["label", "value", "is_sensitive", "sort", "structure_id"],
  contacts: ["name", "phone", "role", "note", "sitter_safe"],
  paints: ["room", "color_name", "brand", "sheen", "hex", "structure_id"],
};

const NUMERIC: Record<string, string[]> = {
  houses: ["year_built", "sqft", "beds", "baths", "lat", "lon"],
  structures: ["sqft", "beds", "baths", "sort"],
  maintenance_items: ["interval_days"],
  seasonal_tasks: ["start_month", "end_month"],
  projects: ["percent", "budget_cents"],
  vitals: ["sort"],
};
const BOOL: Record<string, string[]> = {
  vitals: ["is_sensitive"],
  contacts: ["sitter_safe"],
};
const ARRAY: Record<string, string[]> = {
  projects: ["tags"],
};

export async function POST(req: Request) {
  const { table, action, id, values } = (await req.json()) as {
    table: string;
    action: "insert" | "update" | "delete";
    id?: string;
    values?: Record<string, unknown>;
  };

  if (!COLUMNS[table]) return Response.json({ error: "Unknown table" }, { status: 400 });
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const db = supabaseAdmin();

  // When a write returns zero affected rows with no error, RLS silently blocked
  // it — almost always because SUPABASE_SERVICE_ROLE_KEY holds the wrong value
  // (e.g. the anon key). Surface that instead of failing silently.
  const RLS_HINT =
    "Write was blocked (0 rows changed). This usually means SUPABASE_SERVICE_ROLE_KEY in Vercel " +
    "is not the service_role secret — copy it from Supabase → Settings → API → service_role, then redeploy.";

  if (action === "delete") {
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const { data, error } = await db.from(table).delete().eq("id", id).select("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return Response.json({ error: RLS_HINT }, { status: 403 });
    return Response.json({ ok: true });
  }

  // Coerce incoming form values to the right shapes, dropping anything not allowed.
  const clean: Record<string, unknown> = {};
  for (const k of COLUMNS[table]) {
    if (!values || !(k in values)) continue;
    let v: unknown = values[k];
    if (NUMERIC[table]?.includes(k)) v = v === "" || v == null ? null : Number(v);
    else if (BOOL[table]?.includes(k)) v = !!v;
    else if (ARRAY[table]?.includes(k))
      v = Array.isArray(v) ? v : String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else v = v === "" ? null : v;
    clean[k] = v;
  }

  if (action === "update") {
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const { data, error } = await db.from(table).update(clean).eq("id", id).select("id");
    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return Response.json({ error: RLS_HINT }, { status: 403 });
    return Response.json({ ok: true });
  }

  // insert — attach the (single) house to child tables.
  if (table !== "houses") {
    const { data: house } = await db.from("houses").select("id").limit(1).single();
    clean.house_id = house?.id ?? null;
  }
  const { data, error } = await db.from(table).insert(clean).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ error: RLS_HINT }, { status: 403 });
  return Response.json({ ok: true, id: data[0].id });
}

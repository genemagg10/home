"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/data";
import { monthInSeason } from "@/lib/data";
import type { MaintenanceItem, DueStatus, Weather, Structure } from "@/lib/types";
import { saveRecord } from "@/lib/manage";
import RecordForm, { type Field } from "@/components/RecordForm";
import AddButton from "@/components/AddButton";
import AskHouse from "@/components/AskHouse";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dueLabel(m: MaintenanceItem): { text: string; tone: DueStatus } {
  if (m.status === "overdue" && m.days_remaining != null)
    return { text: `${Math.abs(m.days_remaining)} days late`, tone: "overdue" };
  if (m.status === "soon" && m.days_remaining != null)
    return { text: `in ${m.days_remaining} days`, tone: "soon" };
  if (m.status === "ok" && m.days_remaining != null)
    return { text: `good · ${m.days_remaining}d`, tone: "ok" };
  return { text: "—", tone: "unknown" };
}

const toneClasses: Record<DueStatus, string> = {
  overdue: "bg-[#f7e4e0] text-rose",
  soon: "bg-[#f8efd6] text-[#9a7d1f]",
  ok: "bg-[#e6efe1] text-sage-dark",
  unknown: "bg-[#eee] text-muted",
};
const ringClasses: Record<DueStatus, string> = {
  overdue: "bg-[#f7e4e0] text-rose",
  soon: "bg-[#f8efd6] text-gold",
  ok: "bg-[#e6efe1] text-sage-dark",
  unknown: "bg-[#eee] text-muted",
};

// Field schemas drive the generic add/edit form per table.
const FIELDS: Record<string, Field[]> = {
  structures: [
    { key: "name", label: "Name", placeholder: "The Cottage" },
    { key: "emoji", label: "Emoji", half: true, placeholder: "🏡" },
    { key: "kind", label: "Type", half: true, placeholder: "adu / garage / shed" },
    { key: "sqft", label: "Sq ft", type: "number", half: true },
    { key: "beds", label: "Beds", type: "number", half: true },
    { key: "baths", label: "Baths", type: "number", half: true },
    { key: "sort", label: "Sort order", type: "number", half: true },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Kitchen, living, 1 bath…" },
  ],
  houses: [
    { key: "name", label: "House name" },
    { key: "address", label: "Address" },
    { key: "year_built", label: "Year built", type: "number", half: true },
    { key: "sqft", label: "Sq ft", type: "number", half: true },
    { key: "beds", label: "Beds", type: "number", half: true },
    { key: "baths", label: "Baths", type: "number", half: true },
    { key: "lat", label: "Latitude", type: "number", half: true },
    { key: "lon", label: "Longitude", type: "number", half: true },
    { key: "trash_day", label: "Trash day", half: true },
    { key: "recycle_day", label: "Recycle day", half: true },
  ],
  maintenance_items: [
    { key: "title", label: "Title" },
    { key: "detail", label: "Detail", type: "textarea", placeholder: "Model #, size, where spares live…" },
    { key: "emoji", label: "Emoji", half: true, placeholder: "🔧" },
    { key: "category", label: "Category", type: "select", half: true, options: [
      { value: "replacement", label: "Replacement" },
      { value: "service", label: "Service" },
      { value: "inspection", label: "Inspection" },
    ] },
    { key: "interval_days", label: "Every N days", type: "number", half: true, placeholder: "90" },
    { key: "last_done", label: "Last done", type: "date", half: true },
  ],
  seasonal_tasks: [
    { key: "title", label: "Title" },
    { key: "detail", label: "Detail", type: "textarea" },
    { key: "emoji", label: "Emoji", half: true, placeholder: "🌿" },
    { key: "start_month", label: "Start month", type: "month", half: true },
    { key: "end_month", label: "End month", type: "month", half: true },
  ],
  projects: [
    { key: "title", label: "Title" },
    { key: "status", label: "Status", type: "select", half: true, options: [
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "done", label: "Done" },
    ] },
    { key: "percent", label: "Percent complete", type: "number", half: true, placeholder: "0–100" },
    { key: "next_step", label: "Next step", type: "textarea" },
    { key: "budget_cents", label: "Budget ($)", type: "money", half: true },
    { key: "contractor", label: "Contractor", half: true },
    { key: "tags", label: "Tags (comma-separated)", type: "tags" },
  ],
  vitals: [
    { key: "label", label: "Label", placeholder: "Water shutoff" },
    { key: "value", label: "Value", type: "textarea", placeholder: "Basement, NW corner…" },
    { key: "sort", label: "Sort order", type: "number", half: true },
    { key: "is_sensitive", label: "Hide from sitter export", type: "bool", half: true },
  ],
  contacts: [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone", half: true },
    { key: "role", label: "Role", half: true, placeholder: "Plumber" },
    { key: "note", label: "Note" },
    { key: "sitter_safe", label: "Include in sitter guide", type: "bool" },
  ],
  paints: [
    { key: "room", label: "Room" },
    { key: "color_name", label: "Color name", half: true },
    { key: "brand", label: "Brand", half: true, placeholder: "SW / BM" },
    { key: "sheen", label: "Sheen", half: true, placeholder: "eggshell" },
    { key: "hex", label: "Swatch", type: "color", half: true },
  ],
  appliances: [
    { key: "name", label: "Name", placeholder: "Washer" },
    { key: "emoji", label: "Emoji", half: true, placeholder: "🧺" },
    { key: "status", label: "Status", type: "select", half: true, options: [
      { value: "ok", label: "OK" },
      { value: "service", label: "Needs service" },
      { value: "replace", label: "Replace" },
    ] },
    { key: "brand", label: "Brand", half: true },
    { key: "model", label: "Model", half: true },
    { key: "serial", label: "Serial #", half: true },
    { key: "location", label: "Location", half: true, placeholder: "Cottage laundry" },
    { key: "purchased", label: "Purchased", type: "date", half: true },
    { key: "warranty_until", label: "Warranty until", type: "date", half: true },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  routines: [
    { key: "title", label: "Title", placeholder: "Garbage cans to the curb" },
    { key: "emoji", label: "Emoji", half: true, placeholder: "🗑️" },
    { key: "time_of_day", label: "Time of day", type: "select", half: true, options: [
      { value: "", label: "Anytime" },
      { value: "morning", label: "Morning" },
      { value: "midday", label: "Midday" },
      { value: "evening", label: "Evening" },
    ] },
    { key: "days_of_week", label: "Days it's relevant", type: "weekdays" },
    { key: "detail", label: "Note", type: "textarea", placeholder: "Before Friday pickup" },
    { key: "sort", label: "Sort order", type: "number", half: true },
  ],
};

const FORM_TITLE: Record<string, string> = {
  structures: "structure",
  houses: "house profile",
  maintenance_items: "replacement",
  seasonal_tasks: "seasonal task",
  projects: "project",
  vitals: "vital",
  contacts: "contact",
  paints: "paint",
  appliances: "appliance",
  routines: "routine",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const applianceStatus: Record<string, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-[#e6efe1] text-sage-dark" },
  service: { label: "Needs service", cls: "bg-[#f8efd6] text-[#9a7d1f]" },
  replace: { label: "Replace", cls: "bg-[#f7e4e0] text-rose" },
};

const freezeRe = /faucet|drain|hose|pipe|freeze|outdoor|gutter/i;

type FormState = { table: string; action: "insert" | "update"; id?: string; initial?: Record<string, unknown> } | null;

export default function DashboardClient({ data, weather }: { data: DashboardData; weather: Weather | null }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [yearView, setYearView] = useState(false);
  const [allProjects, setAllProjects] = useState(false);
  const [form, setForm] = useState<FormState>(null);

  // Structure filter: "all" · "main" (untagged / Main House) · a structure id.
  const [structFilter, setStructFilter] = useState<string>("all");
  const structures = data.structures;
  const structById = (id: string | null) => structures.find((s) => s.id === id) || null;
  const selectedStructure = structById(structFilter);
  const matchStruct = (sid: string | null) =>
    structFilter === "all" ? true : structFilter === "main" ? sid == null : sid === structFilter;

  const canManage = !data.usingSeed; // edits only persist with Supabase connected
  const month = new Date().getMonth() + 1;
  const seasonName = ["Winter","Winter","Spring","Spring","Spring","Summer","Summer","Summer","Fall","Fall","Fall","Winter"][month - 1];

  const maintenance = data.maintenance.filter((m) => matchStruct(m.structure_id));
  const needsAttention = maintenance.filter((m) => m.status === "overdue").length;
  const seasonalAll = data.seasonal.filter((s) => matchStruct(s.structure_id));
  const seasonal = yearView ? seasonalAll : seasonalAll.filter((s) => monthInSeason(s, month));
  const projectsAll = data.projects.filter((p) => matchStruct(p.structure_id));
  const projects = allProjects ? projectsAll : projectsAll.filter((p) => p.status === "active");
  const vitals = data.vitals.filter((v) => matchStruct(v.structure_id));
  const paints = data.paints.filter((p) => matchStruct(p.structure_id));
  const appliances = data.appliances.filter((a) => matchStruct(a.structure_id));

  // Routines are whole-property (no structure tag) and surface contextually.
  const dow = new Date().getDay();
  const tomorrowDow = (dow + 1) % 7;
  const todayRoutines = data.routines.filter((r) => r.days_of_week?.includes(dow));
  const tomorrowRoutines = data.routines.filter((r) => r.days_of_week?.includes(tomorrowDow));

  // Tag shown on an item (only while viewing "All") so you can see which
  // building it belongs to at a glance.
  const StructTag = ({ id }: { id: string | null }) => {
    if (structFilter !== "all") return null;
    const s = structById(id);
    if (!s) return null;
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#e9efe6] text-sage-dark whitespace-nowrap">{s.emoji} {s.name}</span>;
  };

  // Append a Structure dropdown to forms for taggable tables.
  const STRUCT_TAGGABLE = new Set(["maintenance_items", "seasonal_tasks", "projects", "vitals", "paints", "appliances"]);
  const structOptions = [
    { value: "", label: "🏠 Main House (whole property)" },
    ...structures.map((s) => ({ value: s.id, label: `${s.emoji} ${s.name}` })),
  ];
  const fieldsFor = (table: string): Field[] => {
    const base = FIELDS[table];
    if (STRUCT_TAGGABLE.has(table) && structures.length > 0)
      return [...base, { key: "structure_id", label: "Structure", type: "select", options: structOptions, half: true }];
    return base;
  };

  async function mutate(table: string, action: "insert" | "update" | "delete", opts: { id?: string; values?: Record<string, unknown> } = {}) {
    await saveRecord(table, action, opts);
    router.refresh();
  }

  async function del(table: string, id: string, label: string) {
    if (!confirm(`Delete "${label}"? This can't be undone.`)) return;
    await mutate(table, "delete", { id });
  }

  const openAdd = (table: string) => setForm({ table, action: "insert" });
  const openEdit = (table: string, id: string, initial: Record<string, unknown>) =>
    setForm({ table, action: "update", id, initial });

  // "seed" is the sentinel id used when no real houses row exists yet, so the
  // house pencil inserts the first time (onboarding) and edits thereafter.
  const hasHouse = data.house.id !== "seed";
  const openHouseForm = () =>
    hasHouse
      ? openEdit("houses", data.house.id, data.house as unknown as Record<string, unknown>)
      : setForm({ table: "houses", action: "insert" });

  // Small icon button used in edit mode.
  const Icon = ({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) => (
    <button onClick={onClick} title={title} className="text-faint hover:text-ink text-[13px] leading-none px-1 py-0.5">
      {children}
    </button>
  );

  const AddLink = ({ table }: { table: string }) =>
    edit && canManage ? (
      <button onClick={() => openAdd(table)} className="ml-auto text-xs text-clay-dark font-sans font-semibold">+ Add</button>
    ) : null;

  return (
    <div className="max-w-[1180px] mx-auto px-6 pb-12">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl grid place-items-center text-2xl"
               style={{ background: "linear-gradient(150deg,#7a8b6f,#5f6f55)", boxShadow: "0 4px 14px rgba(122,139,111,.3)" }}>
            🏰
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold flex items-center gap-2">
              {data.house.name}
              {edit && canManage && (
                <Icon title="Edit house name, address & details" onClick={openHouseForm}>✏️</Icon>
              )}
            </h1>
            <div className="text-muted text-[13px]">
              {[data.house.address, data.house.year_built && `since ${data.house.year_built}`,
                data.house.sqft && `${data.house.sqft.toLocaleString()} sq ft`].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 items-center">
          <a className="btn" href="/sitter">⤓ Sitter guide</a>
          {canManage && (
            <button className={`btn ${edit ? "btn-primary" : ""}`} onClick={() => setEdit((e) => !e)}>
              {edit ? "✓ Done" : "✎ Manage"}
            </button>
          )}
          <AddButton />
        </div>
      </header>

      {/* Greeting + weather */}
      <div className="font-serif text-3xl mt-2 mb-1">
        {needsAttention > 0
          ? <>Good day. Your house has <span className="text-clay">{needsAttention} thing{needsAttention > 1 ? "s" : ""}</span> that need attention.</>
          : <>Good day. Everything's on track at home.</>}
      </div>
      {weather && (
        <div className="text-muted text-sm mb-5">
          {weather.heatWarning ? "🔥" : weather.freezeWarning ? "❄️" : "☀️"} {weather.tempF}°F & {weather.summary} today
          {weather.high != null && <> — high {weather.high}°/low {weather.low}°</>}
          {weather.freezeWarning && <span className="text-rose font-semibold"> · freeze tonight — drain outdoor faucets</span>}
          {weather.heatWarning && <span className="text-clay-dark font-semibold"> · hot — check the AC condenser</span>}
        </div>
      )}

      {/* Review queue banner — top of page, above the ticker and filter, since
          it's only present when review is needed and isn't structure-specific. */}
      {data.pendingCount > 0 && (
        <a href="/review" className="flex items-center gap-3 mb-5 rounded-2xl border border-gold px-5 py-3.5"
           style={{ background: "linear-gradient(100deg,#fbf4e6,#fdf8ee)" }}>
          <span className="text-xl">📥</span>
          <div className="text-sm">
            <b className="font-serif">{data.pendingCount} new upload{data.pendingCount > 1 ? "s" : ""}</b> waiting in your review queue.
            I've drafted tags and a couple of suggested reminders — just give them a thumbs up.
          </div>
          <span className="ml-auto text-clay-dark font-semibold">Review →</span>
        </a>
      )}

      {/* Contextual routine ticker — only what's relevant today/tomorrow */}
      {(todayRoutines.length > 0 || tomorrowRoutines.length > 0) && (
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-sm mb-5 rounded-2xl border border-line bg-card px-4 py-2.5 shadow-soft">
          <span className="text-base">🗓️</span>
          {todayRoutines.length > 0 && (
            <span className="flex items-center gap-x-4 gap-y-1 flex-wrap">
              <span className="text-[11px] uppercase tracking-wide text-sage-dark font-semibold">Today</span>
              {todayRoutines.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5">
                  <span>{r.emoji}</span>
                  <b className="font-semibold">{r.title}</b>
                  {r.detail && <span className="text-muted text-[12.5px]">— {r.detail}</span>}
                </span>
              ))}
            </span>
          )}
          {tomorrowRoutines.length > 0 && (
            <span className="flex items-center gap-x-3 gap-y-1 flex-wrap text-muted">
              <span className="text-[11px] uppercase tracking-wide text-faint font-semibold">Tomorrow</span>
              {tomorrowRoutines.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5 text-[13px]">
                  <span>{r.emoji}</span>{r.title}
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {/* First-run onboarding — shown until a real house row exists */}
      {canManage && !hasHouse && (
        <button onClick={openHouseForm} className="flex w-full items-center gap-3 mb-6 text-left rounded-2xl border border-sage px-5 py-3.5"
                style={{ background: "linear-gradient(100deg,#eef3ea,#f6f9f3)" }}>
          <span className="text-xl">👋</span>
          <div className="text-sm">
            <b className="font-serif">Welcome — let&apos;s set up your house.</b> Add your home&apos;s name and address to get
            started. You&apos;re currently seeing sample placeholder details.
          </div>
          <span className="ml-auto text-sage-dark font-semibold">Set up →</span>
        </button>
      )}

      {edit && canManage && (
        <div className="text-xs text-clay-dark bg-[#fbf4e6] border border-gold rounded-xl px-4 py-2 mb-5">
          Manage mode is on — edit ✏️, delete 🗑, or use “+ Add” on any card. Changes save straight to your database.
        </div>
      )}

      {/* Structure filter — only shown once there's more than the Main House */}
      {(structures.length > 0 || (edit && canManage)) && (
        <div className="flex items-center flex-wrap gap-2 mb-4">
          {([["all", "All"], ["main", "🏠 Main House"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setStructFilter(val)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${structFilter === val ? "bg-sage text-white border-sage" : "border-line bg-card hover:border-sage"}`}>
              {label}
            </button>
          ))}
          {structures.map((s) => (
            <button key={s.id} onClick={() => setStructFilter(s.id)}
              className={`text-sm px-3.5 py-1.5 rounded-full border transition-colors ${structFilter === s.id ? "bg-sage text-white border-sage" : "border-line bg-card hover:border-sage"}`}>
              {s.emoji} {s.name}
            </button>
          ))}
          {edit && canManage && (
            <button onClick={() => openAdd("structures")} className="text-sm px-3.5 py-1.5 rounded-full border border-dashed border-sage text-sage-dark">
              + Structure
            </button>
          )}
        </div>
      )}

      {/* Selected structure's profile */}
      {selectedStructure && (
        <div className="card mb-4 flex items-center gap-3">
          <span className="text-2xl">{selectedStructure.emoji}</span>
          <div className="flex-1">
            <b className="font-serif text-lg">{selectedStructure.name}</b>
            <div className="text-muted text-[13px]">
              {[selectedStructure.kind, selectedStructure.sqft && `${selectedStructure.sqft.toLocaleString()} sq ft`,
                (selectedStructure.beds || selectedStructure.baths) && `${selectedStructure.beds ?? "?"} bd / ${selectedStructure.baths ?? "?"} ba`,
                selectedStructure.notes].filter(Boolean).join(" · ")}
            </div>
          </div>
          {edit && canManage && (
            <div className="flex items-center gap-0.5">
              <Icon title="Edit structure" onClick={() => openEdit("structures", selectedStructure.id, selectedStructure as unknown as Record<string, unknown>)}>✏️</Icon>
              <Icon title="Delete structure" onClick={async () => { await del("structures", selectedStructure.id, selectedStructure.name); setStructFilter("all"); }}>🗑</Icon>
            </div>
          )}
        </div>
      )}

      {/* Review queue banner lives near the top (above the ticker + filter). */}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Replacements */}
        <section className="card">
          <h2 className="card-title">🔧 Coming up to replace
            {edit && canManage
              ? <AddLink table="maintenance_items" />
              : <span className="ml-auto text-xs text-faint font-sans font-normal">{maintenance.length} tracked</span>}
          </h2>
          {maintenance.length === 0 && <p className="text-muted text-sm">Nothing tracked yet.</p>}
          {maintenance.map((m) => {
            const d = dueLabel(m);
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-[#f1ebdd] last:border-0">
                <div className={`w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] ${ringClasses[d.tone]}`}>{m.emoji}</div>
                <div className="flex-1">
                  <b className="font-semibold">{m.title}</b> <StructTag id={m.structure_id} />
                  {m.detail && <small className="block text-muted text-[12.5px] mt-0.5">{m.detail}</small>}
                </div>
                {edit && canManage ? (
                  <div className="flex items-center gap-0.5">
                    <Icon title="Mark done today" onClick={() => mutate("maintenance_items", "update", { id: m.id, values: { last_done: new Date().toISOString().slice(0, 10) } })}>✓</Icon>
                    <Icon title="Edit" onClick={() => openEdit("maintenance_items", m.id, m as unknown as Record<string, unknown>)}>✏️</Icon>
                    <Icon title="Delete" onClick={() => del("maintenance_items", m.id, m.title)}>🗑</Icon>
                  </div>
                ) : (
                  <span className={`pill ${toneClasses[d.tone]}`}>{d.text}</span>
                )}
              </div>
            );
          })}
        </section>

        {/* Seasonal */}
        <section className="card">
          <h2 className="card-title">🌿 {yearView ? "All seasonal tasks" : "This season"}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setYearView((y) => !y)} className="text-xs text-clay-dark font-sans font-semibold">
                {yearView ? "This season" : "Year view"}
              </button>
              <AddLink table="seasonal_tasks" />
              {!edit && <span className="text-xs text-faint font-sans font-normal">{yearView ? `${seasonalAll.length} all year` : seasonName.toLowerCase()}</span>}
            </div>
          </h2>
          {seasonal.length === 0 && <p className="text-muted text-sm">Nothing {yearView ? "yet" : "for this season"}.</p>}
          {seasonal.map((s) => {
            const flag = weather?.freezeWarning && (freezeRe.test(s.title) || freezeRe.test(s.detail || ""));
            return (
              <div key={s.id} className={`flex items-center gap-3 py-2.5 border-b border-[#f1ebdd] last:border-0 ${flag ? "-mx-2 px-2 rounded-lg bg-[#eef3f8]" : ""}`}>
                <div className="w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] bg-[#e3e9ef] text-[#5f7896]">{s.emoji}</div>
                <div className="flex-1">
                  <b className="font-semibold">{s.title}{flag && <span className="text-[#5f7896]"> · ❄️ tonight</span>}</b> <StructTag id={s.structure_id} />
                  {s.detail && <small className="block text-muted text-[12.5px] mt-0.5">{s.detail}</small>}
                </div>
                {edit && canManage ? (
                  <div className="flex items-center gap-0.5">
                    <Icon title="Edit" onClick={() => openEdit("seasonal_tasks", s.id, s as unknown as Record<string, unknown>)}>✏️</Icon>
                    <Icon title="Delete" onClick={() => del("seasonal_tasks", s.id, s.title)}>🗑</Icon>
                  </div>
                ) : (
                  <span className="pill bg-[#e3e9ef] text-[#566f8c]">
                    {s.start_month === s.end_month ? MONTHS[s.start_month - 1] : `${MONTHS[s.start_month - 1]}–${MONTHS[s.end_month - 1]}`}
                  </span>
                )}
              </div>
            );
          })}
        </section>

      {/* Ask the House — sits between "Coming up" and Projects */}
        <div className="md:col-span-2">
          <AskHouse seed={data.usingSeed} />
        </div>

        {/* Projects */}
        <section className="card md:col-span-2">
          <h2 className="card-title">🏗️ Projects{allProjects ? "" : " in progress"}
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setAllProjects((a) => !a)} className="text-xs text-clay-dark font-sans font-semibold">
                {allProjects ? "Active only" : "Show all"}
              </button>
              <AddLink table="projects" />
              {!edit && <span className="text-xs text-faint font-sans font-normal">{projects.length} {allProjects ? "total" : "active"}</span>}
            </div>
          </h2>
          {projects.length === 0 && <p className="text-muted text-sm">No {allProjects ? "" : "active "}projects.</p>}
          {projects.map((p) => (
            <div key={p.id} className="py-3.5 border-b border-[#f1ebdd] last:border-0">
              <div className="flex justify-between items-baseline mb-2 gap-3">
                <b className="font-serif text-base flex items-center gap-2 flex-wrap">
                  {p.title}
                  {p.status !== "active" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f1ece0] text-muted font-sans">{p.status}</span>}
                  <StructTag id={p.structure_id} />
                </b>
                {edit && canManage ? (
                  <div className="flex items-center gap-0.5">
                    {p.status !== "done" && <Icon title="Mark done" onClick={() => mutate("projects", "update", { id: p.id, values: { status: "done", percent: 100 } })}>✓</Icon>}
                    <Icon title="Edit" onClick={() => openEdit("projects", p.id, p as unknown as Record<string, unknown>)}>✏️</Icon>
                    <Icon title="Delete" onClick={() => del("projects", p.id, p.title)}>🗑</Icon>
                  </div>
                ) : (
                  <span className="text-[13px] text-muted">{p.percent}%</span>
                )}
              </div>
              <div className="h-2 rounded-lg bg-[#efe8d9] overflow-hidden">
                <div className="h-full rounded-lg" style={{ width: `${p.percent}%`, background: "linear-gradient(90deg,#7a8b6f,#84a07c)" }} />
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {p.contractor && <span className="text-[11.5px] px-2.5 py-0.5 rounded-2xl bg-[#f1ece0] text-muted">{p.contractor}</span>}
                {p.budget_cents != null && <span className="text-[11.5px] px-2.5 py-0.5 rounded-2xl bg-[#f1ece0] text-muted">budget ${(p.budget_cents / 100).toLocaleString()}</span>}
                {p.tags.map((t) => <span key={t} className="text-[11.5px] px-2.5 py-0.5 rounded-2xl bg-[#f1ece0] text-muted">{t}</span>)}
              </div>
              {p.next_step && <small className="block text-muted text-[12.5px] mt-1.5">Next up — {p.next_step}</small>}
            </div>
          ))}
        </section>

        {/* Vitals */}
        <section className="card">
          <h2 className="card-title">🗝️ Good to know<AddLink table="vitals" /></h2>
          <div className="grid grid-cols-2 gap-3.5">
            {vitals.map((v) => (
              <div key={v.id} className="group">
                <div className="text-[11.5px] text-faint uppercase tracking-wide flex items-center gap-1">
                  {v.label}
                  {edit && canManage && (
                    <span className="flex items-center">
                      <Icon title="Edit" onClick={() => openEdit("vitals", v.id, v as unknown as Record<string, unknown>)}>✏️</Icon>
                      <Icon title="Delete" onClick={() => del("vitals", v.id, v.label)}>🗑</Icon>
                    </span>
                  )}
                </div>
                <div className="text-[13.5px] mt-0.5">{v.value} <StructTag id={v.structure_id} /></div>
              </div>
            ))}
          </div>
        </section>

        {/* Paint library */}
        <section className="card">
          <h2 className="card-title">🎨 Paint library
            {edit && canManage ? <AddLink table="paints" /> : <span className="ml-auto text-xs text-faint font-sans font-normal">by room</span>}
          </h2>
          {paints.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[#f1ebdd] last:border-0">
              <span className="w-[26px] h-[26px] rounded-lg border border-black/10 flex-none" style={{ background: p.hex ?? "#ccc" }} />
              <div className="flex-1">
                <b className="font-semibold">{p.room}</b> <StructTag id={p.structure_id} />
                <small className="block text-muted text-xs">
                  {[p.brand, p.color_name, p.sheen].filter(Boolean).join(" · ")}
                </small>
              </div>
              {edit && canManage && (
                <div className="flex items-center gap-0.5">
                  <Icon title="Edit" onClick={() => openEdit("paints", p.id, p as unknown as Record<string, unknown>)}>✏️</Icon>
                  <Icon title="Delete" onClick={() => del("paints", p.id, p.room)}>🗑</Icon>
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Weekly routines (management list; the ticker up top shows today's) */}
        <section className="card md:col-span-2">
          <h2 className="card-title">🔁 Weekly routines
            {edit && canManage
              ? <AddLink table="routines" />
              : <span className="ml-auto text-xs text-faint font-sans font-normal">recurring</span>}
          </h2>
          {data.routines.length === 0 && (
            <p className="text-muted text-sm">None yet — add things like “bins to the curb” that should just appear on the right day, no checking off.</p>
          )}
          <div className="grid sm:grid-cols-2 gap-x-5">
            {data.routines.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-[#f1ebdd]">
                <div className="w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] bg-[#eef1e8]">{r.emoji}</div>
                <div className="flex-1 min-w-0">
                  <b className="font-semibold">{r.title}</b>
                  {r.detail && <small className="block text-muted text-[12.5px]">{r.detail}</small>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="flex gap-1">
                    {(r.days_of_week ?? []).slice().sort((a, b) => a - b).map((d) => (
                      <span key={d} className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-[#e3e9ef] text-[#566f8c]">{DOW[d]}</span>
                    ))}
                  </span>
                  {edit && canManage && (
                    <div className="flex items-center gap-0.5">
                      <Icon title="Edit" onClick={() => openEdit("routines", r.id, r as unknown as Record<string, unknown>)}>✏️</Icon>
                      <Icon title="Delete" onClick={() => del("routines", r.id, r.title)}>🗑</Icon>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Appliances */}
        <section className="card md:col-span-2">
          <h2 className="card-title">🔌 Appliances
            {edit && canManage
              ? <AddLink table="appliances" />
              : <span className="ml-auto text-xs text-faint font-sans font-normal">{appliances.length} tracked</span>}
          </h2>
          {appliances.length === 0 && <p className="text-muted text-sm">None tracked yet — forward a purchase email or add one in Manage.</p>}
          <div className="grid sm:grid-cols-2 gap-x-5">
            {appliances.map((a) => {
              const st = applianceStatus[a.status] ?? applianceStatus.ok;
              return (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b border-[#f1ebdd]">
                  <div className="w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] bg-[#eef1e8]">{a.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="font-semibold">{a.name}</b>
                      <span className={`pill ${st.cls}`}>{st.label}</span>
                      <StructTag id={a.structure_id} />
                    </div>
                    <small className="block text-muted text-[12.5px] mt-0.5">
                      {[[a.brand, a.model].filter(Boolean).join(" "), a.location].filter(Boolean).join(" · ")}
                    </small>
                    <small className="block text-faint text-[11.5px] mt-0.5">
                      {[a.serial && `S/N ${a.serial}`,
                        a.purchased && `bought ${a.purchased}`,
                        a.warranty_until && `warranty to ${a.warranty_until}`].filter(Boolean).join(" · ")}
                    </small>
                    {a.notes && <small className="block text-muted text-[12px] mt-0.5">{a.notes}</small>}
                  </div>
                  {edit && canManage && (
                    <div className="flex items-center gap-0.5">
                      <Icon title="Edit" onClick={() => openEdit("appliances", a.id, a as unknown as Record<string, unknown>)}>✏️</Icon>
                      <Icon title="Delete" onClick={() => del("appliances", a.id, a.name)}>🗑</Icon>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Contacts */}
        <section className="card md:col-span-2">
          <h2 className="card-title">📇 Trusted contacts<AddLink table="contacts" /></h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {data.contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-1.5">
                <div className="flex-1">
                  <b className="font-semibold">{c.name}</b>
                  <small className="block text-muted text-[12.5px]">
                    {[c.role, c.phone, c.note].filter(Boolean).join(" · ")}
                    {!c.sitter_safe && <span className="text-faint"> · private</span>}
                  </small>
                </div>
                {edit && canManage && (
                  <div className="flex items-center gap-0.5">
                    <Icon title="Edit" onClick={() => openEdit("contacts", c.id, c as unknown as Record<string, unknown>)}>✏️</Icon>
                    <Icon title="Delete" onClick={() => del("contacts", c.id, c.name)}>🗑</Icon>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="text-center text-faint text-xs py-8">
        HomeBase · {data.usingSeed ? "showing sample data — connect Supabase to go live" : "live"}
      </footer>

      {form && (
        <RecordForm
          title={form.table === "houses" && form.action === "insert"
            ? "Set up your house"
            : `${form.action === "insert" ? "Add" : "Edit"} ${FORM_TITLE[form.table]}`}
          fields={fieldsFor(form.table)}
          initial={form.initial}
          submitLabel={form.action === "insert" ? "Add" : "Save"}
          onClose={() => setForm(null)}
          onSubmit={async (values) => { await mutate(form.table, form.action, { id: form.id, values }); }}
        />
      )}
    </div>
  );
}

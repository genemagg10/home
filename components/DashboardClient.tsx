"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/data";
import { monthInSeason } from "@/lib/data";
import type { MaintenanceItem, DueStatus, Weather } from "@/lib/types";
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
};

const FORM_TITLE: Record<string, string> = {
  houses: "house profile",
  maintenance_items: "replacement",
  seasonal_tasks: "seasonal task",
  projects: "project",
  vitals: "vital",
  contacts: "contact",
  paints: "paint",
};

const freezeRe = /faucet|drain|hose|pipe|freeze|outdoor|gutter/i;

type FormState = { table: string; action: "insert" | "update"; id?: string; initial?: Record<string, unknown> } | null;

export default function DashboardClient({ data, weather }: { data: DashboardData; weather: Weather | null }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [yearView, setYearView] = useState(false);
  const [allProjects, setAllProjects] = useState(false);
  const [form, setForm] = useState<FormState>(null);

  const canManage = !data.usingSeed; // edits only persist with Supabase connected
  const month = new Date().getMonth() + 1;
  const seasonName = ["Winter","Winter","Spring","Spring","Spring","Summer","Summer","Summer","Fall","Fall","Fall","Winter"][month - 1];
  const needsAttention = data.maintenance.filter((m) => m.status === "overdue").length;

  const seasonal = yearView ? data.seasonal : data.seasonal.filter((s) => monthInSeason(s, month));
  const projects = allProjects ? data.projects : data.projects.filter((p) => p.status === "active");

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
          <div className="w-12 h-12 rounded-2xl grid place-items-center text-white text-2xl font-serif"
               style={{ background: "linear-gradient(150deg,#7a8b6f,#5f6f55)", boxShadow: "0 4px 14px rgba(122,139,111,.3)" }}>
            ⌂
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold flex items-center gap-2">
              {data.house.name}
              {edit && canManage && (
                <Icon title="Edit house profile" onClick={() => openEdit("houses", data.house.id, data.house as unknown as Record<string, unknown>)}>✏️</Icon>
              )}
            </h1>
            <div className="text-muted text-[13px]">
              {[data.house.address, data.house.year_built && `since ${data.house.year_built}`,
                data.house.sqft && `${data.house.sqft.toLocaleString()} sq ft`].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5 items-center">
          <a className="btn relative" href="/review">
            📥 Review
            {data.pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-clay text-white text-[11px] grid place-items-center">
                {data.pendingCount}
              </span>
            )}
          </a>
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

      {edit && canManage && (
        <div className="text-xs text-clay-dark bg-[#fbf4e6] border border-gold rounded-xl px-4 py-2 mb-5">
          Manage mode is on — edit ✏️, delete 🗑, or use “+ Add” on any card. Changes save straight to your database.
        </div>
      )}

      {/* Review queue banner */}
      {data.pendingCount > 0 && (
        <a href="/review" className="flex items-center gap-3 mb-6 rounded-2xl border border-gold px-5 py-3.5"
           style={{ background: "linear-gradient(100deg,#fbf4e6,#fdf8ee)" }}>
          <span className="text-xl">📥</span>
          <div className="text-sm">
            <b className="font-serif">{data.pendingCount} new upload{data.pendingCount > 1 ? "s" : ""}</b> waiting in your review queue.
            I've drafted tags and a couple of suggested reminders — just give them a thumbs up.
          </div>
          <span className="ml-auto text-clay-dark font-semibold">Review →</span>
        </a>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Replacements */}
        <section className="card">
          <h2 className="card-title">🔧 Coming up to replace
            {edit && canManage
              ? <AddLink table="maintenance_items" />
              : <span className="ml-auto text-xs text-faint font-sans font-normal">{data.maintenance.length} tracked</span>}
          </h2>
          {data.maintenance.length === 0 && <p className="text-muted text-sm">Nothing tracked yet.</p>}
          {data.maintenance.map((m) => {
            const d = dueLabel(m);
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-[#f1ebdd] last:border-0">
                <div className={`w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] ${ringClasses[d.tone]}`}>{m.emoji}</div>
                <div className="flex-1">
                  <b className="font-semibold">{m.title}</b>
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
              {!edit && <span className="text-xs text-faint font-sans font-normal">{yearView ? `${data.seasonal.length} all year` : seasonName.toLowerCase()}</span>}
            </div>
          </h2>
          {seasonal.length === 0 && <p className="text-muted text-sm">Nothing {yearView ? "yet" : "for this season"}.</p>}
          {seasonal.map((s) => {
            const flag = weather?.freezeWarning && (freezeRe.test(s.title) || freezeRe.test(s.detail || ""));
            return (
              <div key={s.id} className={`flex items-center gap-3 py-2.5 border-b border-[#f1ebdd] last:border-0 ${flag ? "-mx-2 px-2 rounded-lg bg-[#eef3f8]" : ""}`}>
                <div className="w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] bg-[#e3e9ef] text-[#5f7896]">{s.emoji}</div>
                <div className="flex-1">
                  <b className="font-semibold">{s.title}{flag && <span className="text-[#5f7896]"> · ❄️ tonight</span>}</b>
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
                <b className="font-serif text-base flex items-center gap-2">
                  {p.title}
                  {p.status !== "active" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f1ece0] text-muted font-sans">{p.status}</span>}
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
            {data.vitals.map((v) => (
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
                <div className="text-[13.5px] mt-0.5">{v.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Paint library */}
        <section className="card">
          <h2 className="card-title">🎨 Paint library
            {edit && canManage ? <AddLink table="paints" /> : <span className="ml-auto text-xs text-faint font-sans font-normal">by room</span>}
          </h2>
          {data.paints.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[#f1ebdd] last:border-0">
              <span className="w-[26px] h-[26px] rounded-lg border border-black/10 flex-none" style={{ background: p.hex ?? "#ccc" }} />
              <div className="flex-1">
                <b className="font-semibold">{p.room}</b>
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

      {/* Ask the House */}
      <AskHouse seed={data.usingSeed} />

      <footer className="text-center text-faint text-xs py-8">
        HomeBase · {data.usingSeed ? "showing sample data — connect Supabase to go live" : "live"}
      </footer>

      {form && (
        <RecordForm
          title={`${form.action === "insert" ? "Add" : "Edit"} ${FORM_TITLE[form.table]}`}
          fields={FIELDS[form.table]}
          initial={form.initial}
          submitLabel={form.action === "insert" ? "Add" : "Save"}
          onClose={() => setForm(null)}
          onSubmit={async (values) => { await mutate(form.table, form.action, { id: form.id, values }); }}
        />
      )}
    </div>
  );
}

import { getDashboardData } from "@/lib/data";
import { getWeather } from "@/lib/weather";
import type { MaintenanceItem, DueStatus } from "@/lib/types";
import AskHouse from "@/components/AskHouse";
import AddButton from "@/components/AddButton";

export const dynamic = "force-dynamic";

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

export default async function Dashboard() {
  const [data, weather] = await Promise.all([getDashboardData(), getWeather()]);
  const needsAttention = data.maintenance.filter((m) => m.status === "overdue").length;
  const seasonName = ["Winter","Winter","Spring","Spring","Spring","Summer","Summer","Summer","Fall","Fall","Fall","Winter"][new Date().getMonth()];

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
            <h1 className="font-serif text-2xl font-semibold">{data.house.name}</h1>
            <div className="text-muted text-[13px]">
              {[data.house.address, data.house.year_built && `since ${data.house.year_built}`,
                data.house.sqft && `${data.house.sqft.toLocaleString()} sq ft`].filter(Boolean).join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <a className="btn" href="/sitter">⤓ Sitter guide</a>
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
            <span className="ml-auto text-xs text-faint font-sans font-normal">{data.maintenance.length} tracked</span>
          </h2>
          {data.maintenance.map((m) => {
            const d = dueLabel(m);
            return (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-[#f1ebdd] last:border-0">
                <div className={`w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] ${ringClasses[d.tone]}`}>{m.emoji}</div>
                <div className="flex-1">
                  <b className="font-semibold">{m.title}</b>
                  {m.detail && <small className="block text-muted text-[12.5px] mt-0.5">{m.detail}</small>}
                </div>
                <span className={`pill ${toneClasses[d.tone]}`}>{d.text}</span>
              </div>
            );
          })}
        </section>

        {/* Seasonal */}
        <section className="card">
          <h2 className="card-title">🌿 This season
            <span className="ml-auto text-xs text-faint font-sans font-normal">{seasonName.toLowerCase()}</span>
          </h2>
          {data.seasonal.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-[#f1ebdd] last:border-0">
              <div className="w-[34px] h-[34px] rounded-full grid place-items-center text-[15px] bg-[#e3e9ef] text-[#5f7896]">{s.emoji}</div>
              <div className="flex-1">
                <b className="font-semibold">{s.title}</b>
                {s.detail && <small className="block text-muted text-[12.5px] mt-0.5">{s.detail}</small>}
              </div>
              <span className="pill bg-[#e3e9ef] text-[#566f8c]">
                {s.start_month === s.end_month ? MONTHS[s.start_month - 1] : `${MONTHS[s.start_month - 1]}–${MONTHS[s.end_month - 1]}`}
              </span>
            </div>
          ))}
        </section>

        {/* Projects */}
        <section className="card md:col-span-2">
          <h2 className="card-title">🏗️ Projects in progress
            <span className="ml-auto text-xs text-faint font-sans font-normal">{data.projects.length} active</span>
          </h2>
          {data.projects.map((p) => (
            <div key={p.id} className="py-3.5 border-b border-[#f1ebdd] last:border-0">
              <div className="flex justify-between items-baseline mb-2">
                <b className="font-serif text-base">{p.title}</b>
                <span className="text-[13px] text-muted">{p.percent}%</span>
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
          <h2 className="card-title">🗝️ Good to know</h2>
          <div className="grid grid-cols-2 gap-3.5">
            {data.vitals.map((v) => (
              <div key={v.id}>
                <div className="text-[11.5px] text-faint uppercase tracking-wide">{v.label}</div>
                <div className="text-[13.5px] mt-0.5">{v.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Paint library */}
        <section className="card">
          <h2 className="card-title">🎨 Paint library
            <span className="ml-auto text-xs text-faint font-sans font-normal">by room</span>
          </h2>
          {data.paints.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-[#f1ebdd] last:border-0">
              <span className="w-[26px] h-[26px] rounded-lg border border-black/10 flex-none" style={{ background: p.hex ?? "#ccc" }} />
              <div>
                <b className="font-semibold">{p.room}</b>
                <small className="block text-muted text-xs">
                  {[p.brand, p.color_name, p.sheen].filter(Boolean).join(" · ")}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Ask the House */}
      <AskHouse seed={data.usingSeed} />

      <footer className="text-center text-faint text-xs py-8">
        HomeBase · {data.usingSeed ? "showing sample data — connect Supabase to go live" : "live"}
      </footer>
    </div>
  );
}

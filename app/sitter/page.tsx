import { getDashboardData } from "@/lib/data";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

// The exportable house-sitter / babysitter guide: a filtered subset of the manual
// (no vault/sensitive items, only sitter-safe contacts). Print to PDF or share.
export default async function SitterGuide() {
  const data = await getDashboardData();
  const vitals = data.vitals.filter((v) => !v.is_sensitive);
  const contacts = data.contacts.filter((c) => c.sitter_safe);

  return (
    <div className="max-w-[760px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <a href="/" className="text-muted text-sm">← Back to dashboard</a>
        <PrintButton />
      </div>

      <h1 className="font-serif text-3xl mb-1">{data.house.name} — Sitter Guide</h1>
      <p className="text-muted mb-6">{data.house.address}</p>

      <section className="card mb-4">
        <h2 className="card-title">🗝️ The essentials</h2>
        <div className="grid grid-cols-2 gap-3.5">
          {vitals.map((v) => (
            <div key={v.id}>
              <div className="text-[11.5px] text-faint uppercase tracking-wide">{v.label}</div>
              <div className="text-[13.5px] mt-0.5">{v.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-4">
        <h2 className="card-title">🗑️ Trash & recycling</h2>
        <p className="text-[14px]">
          Trash: <b>{data.house.trash_day ?? "—"}</b> · Recycling: <b>{data.house.recycle_day ?? "—"}</b>
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">📇 Who to call</h2>
        {contacts.map((c) => (
          <div key={c.id} className="flex justify-between py-2 border-b border-[#f1ebdd] last:border-0">
            <div>
              <b>{c.name}</b>{c.role && <span className="text-muted text-sm"> · {c.role}</span>}
            </div>
            <div className="text-muted text-sm">{c.phone}</div>
          </div>
        ))}
      </section>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { DocumentRow, Structure } from "@/lib/types";

export default function ReviewList({ items, structures = [] }: { items: DocumentRow[]; structures?: Structure[] }) {
  const [docs, setDocs] = useState(items);
  const [acceptTask, setAcceptTask] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((d) => [d.id, true]))
  );
  const [acceptAppliance, setAcceptAppliance] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((d) => [d.id, !!d.ai_suggested_appliance]))
  );
  const [applianceStruct, setApplianceStruct] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          acceptTask: acceptTask[id],
          acceptAppliance: acceptAppliance[id],
          applianceStructureId: applianceStruct[id] || null,
        }),
      });
      if (res.ok) setDocs((d) => d.filter((x) => x.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (docs.length === 0) return <div className="card text-muted">All caught up ✓</div>;

  return (
    <div className="flex flex-col gap-4">
      {docs.map((d) => (
        <div key={d.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11.5px] px-2.5 py-0.5 rounded-2xl bg-[#f1ece0] text-muted">
                {d.kind === "image" ? "🖼️ image" : d.kind === "pdf" ? "📄 pdf" : d.kind === "link" ? "🔗 link" : "📝 note"}
                {d.ai_category && ` · ${d.ai_category}`}
              </span>
              <h2 className="font-serif text-lg mt-2">{d.title}</h2>
            </div>
          </div>
          {d.ai_summary && <p className="text-[13.5px] text-muted mt-1">{d.ai_summary}</p>}
          {d.file_url && (
            <a href={d.file_url} target="_blank" rel="noopener noreferrer"
               className="inline-block mt-2 text-[12.5px] text-clay-dark font-semibold underline">
              {d.kind === "image" ? "🖼️ View image" : "📄 View file"}
            </a>
          )}
          {d.ai_tags?.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-2">
              {d.ai_tags.map((t) => (
                <span key={t} className="text-[11.5px] px-2.5 py-0.5 rounded-2xl bg-[#eef1e8] text-sage-dark">#{t}</span>
              ))}
            </div>
          )}

          {d.ai_suggested_task && (
            <label className="flex items-center gap-2 mt-3 text-sm bg-[#fbf4e6] border border-gold rounded-xl px-3 py-2.5 cursor-pointer">
              <input type="checkbox" checked={acceptTask[d.id] ?? true}
                     onChange={(e) => setAcceptTask((s) => ({ ...s, [d.id]: e.target.checked }))} />
              <span>
                Also track: <b>{d.ai_suggested_task.title}</b>
                {d.ai_suggested_task.interval_days && <> — every {d.ai_suggested_task.interval_days} days</>}
              </span>
            </label>
          )}

          {d.ai_suggested_appliance && (
            <div className="mt-3 text-sm bg-[#eef3ea] border border-sage rounded-xl px-3 py-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={acceptAppliance[d.id] ?? true}
                       onChange={(e) => setAcceptAppliance((s) => ({ ...s, [d.id]: e.target.checked }))} />
                <span>
                  Add appliance: <b>{d.ai_suggested_appliance.name}</b>
                  {(d.ai_suggested_appliance.brand || d.ai_suggested_appliance.model) &&
                    <> — {[d.ai_suggested_appliance.brand, d.ai_suggested_appliance.model].filter(Boolean).join(" ")}</>}
                </span>
              </label>
              <div className="text-[12px] text-muted mt-1 ml-6">
                {[d.ai_suggested_appliance.serial && `S/N ${d.ai_suggested_appliance.serial}`,
                  d.ai_suggested_appliance.purchased && `bought ${d.ai_suggested_appliance.purchased}`,
                  d.ai_suggested_appliance.warranty_until && `warranty to ${d.ai_suggested_appliance.warranty_until}`,
                ].filter(Boolean).join(" · ")}
              </div>
              {structures.length > 0 && (acceptAppliance[d.id] ?? true) && (
                <div className="mt-2 ml-6 flex items-center gap-2 text-[13px]">
                  <span className="text-muted">Located in</span>
                  <select
                    className="border border-line rounded-lg px-2 py-1 bg-card text-sm outline-none focus:border-sage"
                    value={applianceStruct[d.id] ?? ""}
                    onChange={(e) => setApplianceStruct((s) => ({ ...s, [d.id]: e.target.value }))}>
                    <option value="">🏠 Main House</option>
                    {structures.map((st) => <option key={st.id} value={st.id}>{st.emoji} {st.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end mt-3">
            <button className="btn" disabled={busy === d.id} onClick={() => act(d.id, "reject")}>Reject</button>
            <button className="btn btn-primary" disabled={busy === d.id} onClick={() => act(d.id, "approve")}>
              {busy === d.id ? "…" : "Approve & publish"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

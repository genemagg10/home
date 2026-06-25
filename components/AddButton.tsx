"use client";

import { useState } from "react";

// The "+ Add anything" entry point. Accepts a typed note or a link now; PDF/image
// upload to Supabase Storage is wired in the ingest route (see README). Whatever
// you add lands in the review queue with AI-suggested tags you approve.
export default function AddButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"note" | "link">("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  async function submit() {
    if (!title.trim()) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, text: kind === "note" ? body : "", source_url: kind === "link" ? body : null }),
      });
      setStatus(res.ok ? "done" : "error");
      if (res.ok) { setTitle(""); setBody(""); setTimeout(() => { setOpen(false); setStatus("idle"); }, 1200); }
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Add anything</button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="card-title">📥 Add to the manual</h2>
            <div className="flex gap-2 mb-3">
              {(["note", "link"] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)}
                        className={`btn ${kind === k ? "btn-primary" : ""}`}>
                  {k === "note" ? "📝 Note" : "🔗 Link"}
                </button>
              ))}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Fridge water filter)"
                   className="w-full border border-line rounded-xl px-3 py-2.5 mb-2.5 bg-card text-sm outline-none focus:border-sage" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
                      placeholder={kind === "note" ? "Type anything — model #, where it lives, how often…" : "Paste a URL"}
                      rows={4}
                      className="w-full border border-line rounded-xl px-3 py-2.5 mb-3 bg-card text-sm outline-none focus:border-sage" />
            <p className="text-faint text-xs mb-3">
              I'll suggest a category, tags, and any recurring reminder. Nothing publishes until you approve it in the review queue.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={status === "saving"}>
                {status === "saving" ? "Saving…" : status === "done" ? "Added ✓" : status === "error" ? "Retry" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

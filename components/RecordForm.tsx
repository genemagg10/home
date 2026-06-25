"use client";

import { useState } from "react";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "money" | "month" | "bool" | "tags" | "color" | "date" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  half?: boolean; // render at half width on wider screens
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const inputCls =
  "w-full border border-line rounded-xl px-3 py-2.5 bg-card text-sm outline-none focus:border-sage";

// Generic add/edit modal. The parent supplies a field schema and a submit
// handler; this component handles typing/coercion so values come back as the
// right JS shapes (numbers, booleans, string[], cents for money).
export default function RecordForm({
  title,
  fields,
  initial,
  submitLabel = "Save",
  onSubmit,
  onClose,
}: {
  title: string;
  fields: Field[];
  initial?: Record<string, unknown>;
  submitLabel?: string;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, unknown>>(() => {
    const base: Record<string, unknown> = {};
    for (const f of fields) {
      let val = initial?.[f.key];
      if (f.type === "money") val = val != null ? Number(val) / 100 : "";
      else if (f.type === "tags") val = Array.isArray(val) ? val.join(", ") : val ?? "";
      else if (f.type === "bool") val = !!val;
      else val = val ?? "";
      base[f.key] = val;
    }
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));

  async function save() {
    setBusy(true);
    setErr(null);
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = v[f.key];
      if (f.type === "number" || f.type === "month") out[f.key] = raw === "" || raw == null ? null : Number(raw);
      else if (f.type === "money") out[f.key] = raw === "" || raw == null ? null : Math.round(Number(raw) * 100);
      else if (f.type === "tags") out[f.key] = String(raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      else if (f.type === "bool") out[f.key] = !!raw;
      else out[f.key] = raw === "" ? null : raw;
    }
    try {
      await onSubmit(out);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="card-title">{title}</h2>
        <div className="flex flex-wrap gap-3">
          {fields.map((f) => (
            <label key={f.key} className={f.half ? "block w-[calc(50%-0.375rem)]" : "block w-full"}>
              {f.type !== "bool" && (
                <span className="text-[11.5px] text-faint uppercase tracking-wide block mb-1">{f.label}</span>
              )}
              {f.type === "textarea" ? (
                <textarea
                  className={inputCls}
                  rows={3}
                  value={String(v[f.key] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : f.type === "bool" ? (
                <span className="flex items-center gap-2 text-sm mt-5">
                  <input type="checkbox" checked={!!v[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                  {f.label}
                </span>
              ) : f.type === "month" ? (
                <select className={inputCls} value={String(v[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">—</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              ) : f.type === "select" ? (
                <select className={inputCls} value={String(v[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : f.type === "color" ? (
                <span className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-10 w-12 rounded-lg border border-line bg-card"
                    value={String(v[f.key] || "#cccccc")}
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                  <input
                    className={inputCls}
                    value={String(v[f.key] ?? "")}
                    placeholder="#hex"
                    onChange={(e) => set(f.key, e.target.value)}
                  />
                </span>
              ) : (
                <input
                  className={inputCls}
                  type={f.type === "number" || f.type === "money" ? "number" : f.type === "date" ? "date" : "text"}
                  step={f.type === "money" ? "0.01" : undefined}
                  value={String(v[f.key] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>

        {err && <p className="text-rose text-sm mt-3">{err}</p>}

        <div className="flex gap-2 justify-end mt-4">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

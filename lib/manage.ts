// Tiny client-side wrapper around /api/manage. Throws on failure so callers can
// surface an error; otherwise resolves once the row is written.
export async function saveRecord(
  table: string,
  action: "insert" | "update" | "delete",
  opts: { id?: string; values?: Record<string, unknown> } = {}
): Promise<void> {
  const res = await fetch("/api/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, action, id: opts.id, values: opts.values }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || `Save failed (${res.status})`);
  }
}

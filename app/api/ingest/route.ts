import { extractMetadata } from "@/lib/extract";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

// Manual "+ Add anything" entry point. Accepts a typed note or a link; the
// shared extractor proposes metadata, and the item lands in the review queue.
// (Forwarded email and file attachments go through /api/inbound-email.)
export async function POST(req: Request) {
  const body = (await req.json()) as {
    kind: "note" | "link" | "pdf" | "image";
    title: string;
    text?: string;
    source_url?: string | null;
  };

  if (!body.title?.trim()) return Response.json({ error: "Title required" }, { status: 400 });

  let rawText = body.text ?? "";
  if (body.kind === "link" && body.source_url) {
    rawText = await fetchLinkText(body.source_url, body.title);
  }

  const suggestion = await extractMetadata([
    { type: "text", text: `Title: ${body.title}\nKind: ${body.kind}\n\nContent:\n${rawText || "(no body text)"}` },
  ]);

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ ok: true, demo: true, suggestion });
  }

  const db = supabaseAdmin();
  const { data: house } = await db.from("houses").select("id").limit(1).single();

  const { data, error } = await db
    .from("documents")
    .insert({
      house_id: house?.id ?? null,
      title: suggestion?.title || body.title,
      kind: body.kind,
      source_url: body.source_url ?? null,
      raw_text: rawText,
      ai_summary: suggestion?.summary ?? null,
      ai_category: suggestion?.category ?? null,
      ai_tags: suggestion?.tags ?? [],
      ai_suggested_task: suggestion?.suggested_task ?? null,
      ai_suggested_appliance: suggestion?.appliance ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data.id, suggestion });
}

async function fetchLinkText(url: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000);
  } catch {
    return fallback;
  }
}

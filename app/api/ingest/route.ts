import { anthropic, EXTRACT_MODEL } from "@/lib/anthropic";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

// Structured schema the model fills in. This is the "AI suggests, you approve" pass.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A clean, short title for this item" },
    summary: { type: "string", description: "1-2 sentence summary of what this is" },
    category: {
      type: "string",
      enum: ["appliance", "warranty", "receipt", "manual", "paint", "contact", "project", "reference", "other"],
    },
    tags: { type: "array", items: { type: "string" }, description: "3-6 lowercase tags" },
    has_recurring_task: {
      type: "boolean",
      description: "True only if the content clearly implies a recurring chore (filters, batteries, servicing).",
    },
    suggested_task: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        interval_days: { type: "integer", description: "0 when has_recurring_task is false" },
        detail: { type: "string" },
      },
      required: ["title", "interval_days", "detail"],
    },
  },
  required: ["title", "summary", "category", "tags", "has_recurring_task", "suggested_task"],
};

export async function POST(req: Request) {
  const body = (await req.json()) as {
    kind: "note" | "link" | "pdf" | "image";
    title: string;
    text?: string;
    source_url?: string | null;
  };

  if (!body.title?.trim()) return Response.json({ error: "Title required" }, { status: 400 });

  // Gather text to analyze. (PDF/image text extraction happens upstream of this
  // route — see README; here we accept already-extracted text.)
  let rawText = body.text ?? "";
  if (body.kind === "link" && body.source_url) {
    rawText = await fetchLinkText(body.source_url, body.title);
  }

  // AI suggestion pass (cheap model). We force a single tool call so the model
  // returns exactly the structured metadata shape — reliable on this SDK version.
  let suggestion: any = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await anthropic.messages.create({
        model: EXTRACT_MODEL,
        max_tokens: 700,
        system:
          "You help a homeowner file documents into their house manual. Read the content and propose tidy metadata. " +
          "Only set has_recurring_task=true when the content clearly implies a recurring chore (filters, batteries, servicing).",
        tools: [{ name: "file_document", description: "Record metadata for this document.", input_schema: SCHEMA as any }],
        tool_choice: { type: "tool", name: "file_document" },
        messages: [{ role: "user", content: `Title: ${body.title}\nKind: ${body.kind}\n\nContent:\n${rawText || "(no body text)"}` }],
      });
      const toolBlock = res.content.find((b) => b.type === "tool_use");
      if (toolBlock && toolBlock.type === "tool_use") {
        suggestion = toolBlock.input as any;
        if (!suggestion.has_recurring_task) suggestion.suggested_task = null;
      }
    } catch (e) {
      console.error("Extraction failed:", e);
    }
  }

  // Persist as a pending document for the review queue.
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
    // Strip tags crudely — good enough for the suggestion pass.
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

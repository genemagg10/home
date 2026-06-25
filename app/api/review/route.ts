import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { embed, chunkText } from "@/lib/embeddings";

export const runtime = "nodejs";
export const maxDuration = 60;

// Approve or reject a pending upload. Approving is what actually publishes a
// document into the searchable manual — embeds its chunks and (optionally)
// creates the AI-suggested recurring reminder.
export async function POST(req: Request) {
  const { id, action, acceptTask, acceptAppliance, applianceStructureId } = (await req.json()) as {
    id: string;
    action: "approve" | "reject";
    acceptTask?: boolean;
    acceptAppliance?: boolean;
    applianceStructureId?: string | null;
  };

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const db = supabaseAdmin();

  if (action === "reject") {
    await db.from("documents").update({ status: "rejected" }).eq("id", id);
    return Response.json({ ok: true });
  }

  // Approve: load the doc, chunk + embed, publish.
  const { data: doc, error } = await db.from("documents").select("*").eq("id", id).single();
  if (error || !doc) return Response.json({ error: "Document not found" }, { status: 404 });

  const chunks = chunkText(doc.raw_text || `${doc.title}\n${doc.ai_summary ?? ""}`);
  if (chunks.length && process.env.OPENAI_API_KEY) {
    try {
      const vectors = await embed(chunks);
      await db.from("doc_chunks").insert(
        chunks.map((content, i) => ({
          document_id: doc.id,
          house_id: doc.house_id,
          content,
          embedding: vectors[i],
        }))
      );
    } catch (e) {
      console.error("Embedding on approve failed:", e);
      return Response.json({ error: "Failed to embed document" }, { status: 500 });
    }
  }

  await db.from("documents").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id);

  // Optionally turn the AI-suggested chore into a tracked maintenance item.
  if (acceptTask && doc.ai_suggested_task) {
    const t = doc.ai_suggested_task as { title: string; interval_days?: number; detail?: string };
    await db.from("maintenance_items").insert({
      house_id: doc.house_id,
      title: t.title,
      detail: t.detail ?? null,
      interval_days: t.interval_days ?? null,
      last_done: new Date().toISOString().slice(0, 10),
      category: "replacement",
    });
  }

  // Optionally register the AI-suggested appliance (e.g. from a purchase email).
  if (acceptAppliance && doc.ai_suggested_appliance) {
    const a = doc.ai_suggested_appliance as {
      name: string; brand?: string; model?: string; serial?: string;
      purchased?: string; warranty_until?: string; notes?: string;
    };
    await db.from("appliances").insert({
      house_id: doc.house_id,
      structure_id: applianceStructureId || null,
      name: a.name,
      brand: a.brand || null,
      model: a.model || null,
      serial: a.serial || null,
      purchased: a.purchased || null,
      warranty_until: a.warranty_until || null,
      notes: a.notes || null,
      status: "ok",
    });
  }

  return Response.json({ ok: true });
}

import { anthropic, CHAT_MODEL } from "@/lib/anthropic";
import { embedOne } from "@/lib/embeddings";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM = `You are "the House" — a warm, concise assistant that knows everything about this home.
Answer using ONLY the context provided from the homeowner's manual (manuals, receipts, photos, notes).
If the context doesn't cover it, say so plainly and suggest what to add. Prefer specifics: model numbers,
locations, dates, quantities. Keep answers short and practical — this is a glanceable home dashboard.`;

function sse(obj: unknown) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };
  if (!question?.trim()) return new Response("Ask a question.", { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("Set ANTHROPIC_API_KEY to enable chat.", { status: 503 });
  }

  // 1. Retrieve relevant chunks (RAG). Degrades gracefully if not configured.
  let context = "";
  let sources: { doc_title: string; doc_kind: string }[] = [];
  if (isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.OPENAI_API_KEY) {
    try {
      const queryEmbedding = await embedOne(question);
      const db = supabaseAdmin();
      const { data } = await db.rpc("match_chunks", {
        query_embedding: queryEmbedding,
        match_count: 6,
        similarity_threshold: 0.2,
      });
      const rows = (data as { content: string; doc_title: string; doc_kind: string }[]) ?? [];
      context = rows.map((r, i) => `[${i + 1}] (${r.doc_title})\n${r.content}`).join("\n\n");
      const seen = new Set<string>();
      sources = rows
        .filter((r) => (seen.has(r.doc_title) ? false : (seen.add(r.doc_title), true)))
        .map((r) => ({ doc_title: r.doc_title, doc_kind: r.doc_kind }));
    } catch (e) {
      console.error("RAG retrieval failed:", e);
    }
  }

  const userContent = context
    ? `Context from the manual:\n\n${context}\n\n---\nQuestion: ${question}`
    : `Question: ${question}\n\n(No documents are indexed yet — answer from general home knowledge and note that adding manuals/notes will make answers specific to this house.)`;

  // 2. Stream Claude's answer, prefixed with the source chips.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      if (sources.length) controller.enqueue(encoder.encode(sse({ sources })));
      try {
        const claudeStream = anthropic.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 1024,
          system: SYSTEM,
          messages: [{ role: "user", content: userContent }],
        });
        for await (const event of claudeStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(sse({ text: event.delta.text })));
          }
        }
      } catch (e) {
        console.error("Claude stream failed:", e);
        controller.enqueue(encoder.encode(sse({ text: "\n\n⚠️ I hit an error reaching the model." })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

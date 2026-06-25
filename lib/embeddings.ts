// Embeddings for RAG. Anthropic has no embeddings endpoint, so we use OpenAI's
// text-embedding-3-small (1536 dims — matches the vector column in the schema).
// Swap providers here without touching the rest of the app.

const EMBED_MODEL = process.env.HOMEBASE_EMBED_MODEL || "text-embedding-3-small";

export async function embed(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set (needed for RAG embeddings)");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

export async function embedOne(text: string): Promise<number[]> {
  return (await embed([text]))[0];
}

// Naive paragraph-aware chunker. Good enough for manuals/notes; tune later.
export function chunkText(text: string, maxChars = 1200): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > maxChars && buf) {
      chunks.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

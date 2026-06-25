import { supabaseAdmin } from "./supabase";
import { extractMetadata, type ContentBlock } from "./extract";

// Files a forwarded email (and its attachments) into the review queue as pending
// documents. Attachments are stored in the private "inbox" Storage bucket; Claude
// reads images/PDFs directly to pull out the specifics.

export interface InboundAttachment {
  filename: string;
  contentType: string;
  dataBase64: string;
}

const isImage = (t: string) => /^image\//i.test(t);
const isPdf = (t: string) => /^application\/pdf$/i.test(t);
const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";

export async function fileInboundEmail(input: {
  from?: string;
  subject?: string;
  text?: string;
  attachments?: InboundAttachment[];
}): Promise<number> {
  const db = supabaseAdmin();
  const { data: house } = await db.from("houses").select("id").limit(1).single();
  const houseId = house?.id ?? null;

  const subject = (input.subject || "Forwarded email").trim();
  const body = (input.text || "").trim();
  const fromLine = input.from ? `From: ${input.from}\n` : "";
  const attachments = input.attachments ?? [];
  let filed = 0;

  async function addDoc(opts: { title: string; kind: string; sourcePath: string | null; rawText: string; blocks: ContentBlock[] }) {
    const suggestion = await extractMetadata(opts.blocks);
    // Fold the extracted specifics into raw_text so they're indexed for RAG on approval.
    const rawText = suggestion?.summary ? `${opts.rawText}\n\nExtracted details:\n${suggestion.summary}` : opts.rawText;
    const { error } = await db.from("documents").insert({
      house_id: houseId,
      title: suggestion?.title || opts.title,
      kind: opts.kind,
      source_url: opts.sourcePath,
      raw_text: rawText,
      ai_summary: suggestion?.summary ?? null,
      ai_category: suggestion?.category ?? null,
      ai_tags: suggestion?.tags ?? [],
      ai_suggested_task: suggestion?.suggested_task ?? null,
      ai_suggested_appliance: suggestion?.appliance ?? null,
      status: "pending",
    });
    if (error) console.error("inbound insert failed:", error.message);
    else filed++;
  }

  if (attachments.length === 0) {
    await addDoc({
      title: subject,
      kind: "note",
      sourcePath: null,
      rawText: `${fromLine}Subject: ${subject}\n\n${body}`,
      blocks: [{ type: "text", text: `An email was forwarded in.\nSubject: ${subject}\nFrom: ${input.from ?? "?"}\n\n${body || "(no body text)"}` }],
    });
    return filed;
  }

  for (const a of attachments) {
    // Store the original file (private bucket; viewed later via signed URL).
    let sourcePath: string | null = null;
    try {
      const path = `inbound/${Date.now()}-${sanitize(a.filename)}`;
      const buf = Buffer.from(a.dataBase64, "base64");
      const { error } = await db.storage.from("inbox").upload(path, buf, { contentType: a.contentType, upsert: false });
      if (error) console.error("attachment upload failed:", error.message);
      else sourcePath = path;
    } catch (e) {
      console.error("attachment upload threw:", e);
    }

    const blocks: ContentBlock[] = [
      { type: "text", text: `An email was forwarded in with this attachment.\nSubject: ${subject}\nFrom: ${input.from ?? "?"}\n${body ? `\nEmail body:\n${body}\n` : ""}\nExtract the home-relevant details from the attached file "${a.filename}".` },
    ];
    if (isImage(a.contentType)) blocks.push({ type: "image", source: { type: "base64", media_type: a.contentType, data: a.dataBase64 } });
    else if (isPdf(a.contentType)) blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.dataBase64 } });

    await addDoc({
      title: `${subject} — ${a.filename}`,
      kind: isImage(a.contentType) ? "image" : isPdf(a.contentType) ? "pdf" : "note",
      sourcePath,
      rawText: `${fromLine}Subject: ${subject}\nAttachment: ${a.filename}\n\n${body}`,
      blocks,
    });
  }

  return filed;
}

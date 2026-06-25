import { anthropic, EXTRACT_MODEL } from "./anthropic";

// Shared "AI suggests, you approve" extraction. Used by manual adds (/api/ingest)
// and forwarded email (/api/inbound-email). Accepts text plus optional image/PDF
// blocks so Claude can read attachments directly — no OCR library needed.

export const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "A clean, short title for this item" },
    summary: {
      type: "string",
      description:
        "2-4 sentences capturing the concrete specifics: model numbers, serial numbers, prices/costs, " +
        "vendor or contractor names, dates, warranty terms, quantities. This is what gets searched later.",
    },
    category: {
      type: "string",
      enum: ["appliance", "warranty", "receipt", "quote", "manual", "paint", "contact", "project", "reference", "other"],
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
} as const;

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export interface Suggestion {
  title: string;
  summary: string;
  category: string;
  tags: string[];
  has_recurring_task: boolean;
  suggested_task: { title: string; interval_days?: number; detail?: string } | null;
}

const SYSTEM =
  "You help a homeowner file documents into their house manual. Read the content (including any attached " +
  "image or PDF) and propose tidy metadata. Pull out concrete specifics — model numbers, serial numbers, " +
  "prices, vendor/contractor names, dates, warranty terms. Only set has_recurring_task=true when the content " +
  "clearly implies a recurring chore (filters, batteries, servicing).";

export async function extractMetadata(blocks: ContentBlock[]): Promise<Suggestion | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const res = await anthropic.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: 900,
      system: SYSTEM,
      tools: [{ name: "file_document", description: "Record metadata for this document.", input_schema: EXTRACT_SCHEMA as any }],
      tool_choice: { type: "tool", name: "file_document" },
      messages: [{ role: "user", content: blocks as any }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use") {
      const s = block.input as Suggestion;
      if (!s.has_recurring_task) s.suggested_task = null;
      return s;
    }
  } catch (e) {
    console.error("Extraction failed:", e);
  }
  return null;
}

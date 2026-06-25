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
    has_appliance: {
      type: "boolean",
      description:
        "True if the content describes a specific appliance or piece of equipment (washer, dryer, fridge, " +
        "HVAC, water heater, dishwasher, etc.) with identifiable details like a model or serial number — " +
        "e.g. a purchase confirmation or spec sheet.",
    },
    appliance: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", description: "Short name, e.g. 'Washer' or 'Dryer'" },
        brand: { type: "string" },
        model: { type: "string" },
        serial: { type: "string" },
        purchased: { type: "string", description: "Purchase date as YYYY-MM-DD if known, else empty string" },
        warranty_until: { type: "string", description: "Warranty end date as YYYY-MM-DD if stated, else empty string" },
        notes: { type: "string", description: "Anything useful: price, retailer, capacity, color" },
      },
      required: ["name", "brand", "model", "serial", "purchased", "warranty_until", "notes"],
    },
  },
  required: ["title", "summary", "category", "tags", "has_recurring_task", "suggested_task", "has_appliance", "appliance"],
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
  has_appliance: boolean;
  appliance: {
    name: string; brand?: string; model?: string; serial?: string;
    purchased?: string; warranty_until?: string; notes?: string;
  } | null;
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
      if (!s.has_appliance) s.appliance = null;
      // Normalize empty-string dates to null so Postgres accepts them.
      if (s.appliance) {
        if (!s.appliance.purchased) s.appliance.purchased = undefined;
        if (!s.appliance.warranty_until) s.appliance.warranty_until = undefined;
      }
      return s;
    }
  } catch (e) {
    console.error("Extraction failed:", e);
  }
  return null;
}

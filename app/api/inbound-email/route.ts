import { fileInboundEmail, type InboundAttachment } from "@/lib/inbound";

export const runtime = "nodejs";
export const maxDuration = 60;

// Webhook for forwarded email. A Google Apps Script on the inbox POSTs JSON here:
//   { from, subject, text, attachments: [{ filename, contentType, dataBase64 }] }
// Protected by a shared secret (header x-inbox-token or ?token=). Optionally
// restricted to known senders via INBOX_ALLOWED_SENDERS.
export async function POST(req: Request) {
  const secret = process.env.INBOX_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Inbox webhook not configured" }, { status: 503 });

  const url = new URL(req.url);
  const token = req.headers.get("x-inbox-token") || url.searchParams.get("token");
  if (token !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    from?: string; subject?: string; text?: string; attachments?: InboundAttachment[];
  } | null;
  if (!body) return Response.json({ error: "Invalid JSON body" }, { status: 400 });

  // Optional sender allowlist (comma-separated substrings, e.g. your address).
  const allow = (process.env.INBOX_ALLOWED_SENDERS || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const from = String(body.from || "").toLowerCase();
  if (allow.length && !allow.some((a) => from.includes(a))) {
    return Response.json({ error: "Sender not allowed" }, { status: 403 });
  }

  try {
    const filed = await fileInboundEmail({
      from: body.from,
      subject: body.subject,
      text: body.text,
      attachments: body.attachments,
    });
    return Response.json({ ok: true, filed });
  } catch (e) {
    console.error("inbound-email failed:", e);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}

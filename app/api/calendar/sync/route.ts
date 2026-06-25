import { google } from "googleapis";
import { authorizedClient } from "@/lib/google";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// Push upcoming maintenance due dates to Google Calendar as all-day events.
// One-way only. Idempotent-ish: tags events with an extendedProperty so a
// future version can dedupe; for the MVP it simply creates upcoming items.
//
// Triggered two ways:
//   - POST from the app ("Sync now" button)
//   - GET from a Vercel Cron (see vercel.json). If CRON_SECRET is set, the cron
//     must send `Authorization: Bearer <CRON_SECRET>` (Vercel does this for you).
async function runSync(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = await authorizedClient();
  if (!auth) return Response.json({ error: "Google Calendar not connected" }, { status: 503 });

  const db = supabaseAdmin();
  const { data: items } = await db
    .from("maintenance_due")
    .select("*")
    .not("due_date", "is", null)
    .lte("days_remaining", 60);

  const calendar = google.calendar({ version: "v3", auth: auth.client });
  let created = 0;

  for (const m of items ?? []) {
    await calendar.events.insert({
      calendarId: auth.calendarId,
      requestBody: {
        summary: `🏠 ${m.title}`,
        description: m.detail ?? "Home maintenance (via HomeBase)",
        start: { date: m.due_date },
        end: { date: m.due_date },
        extendedProperties: { private: { homebase_item: m.id } },
        reminders: { useDefault: true },
      },
    });
    created++;
  }

  return Response.json({ ok: true, created });
}

export const POST = runSync;
export const GET = runSync;

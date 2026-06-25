import { google } from "googleapis";
import { supabaseAdmin } from "./supabase";
import { googleRedirectUri } from "./site";

// One-way push to Google Calendar: HomeBase writes maintenance/seasonal due dates
// out as all-day events. We never read the user's calendar back.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri()
  );
}

export function authUrl(): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Returns an authorized client using the stored refresh token, or null if the
// user hasn't connected Google yet.
export async function authorizedClient() {
  const db = supabaseAdmin();
  const { data } = await db.from("integrations").select("*").eq("provider", "google_calendar").single();
  if (!data?.refresh_token) return null;

  const client = oauthClient();
  client.setCredentials({
    refresh_token: data.refresh_token,
    access_token: data.access_token ?? undefined,
    expiry_date: data.expiry ? new Date(data.expiry).getTime() : undefined,
  });
  return { client, calendarId: data.calendar_id || "primary" };
}

export async function saveTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}) {
  const db = supabaseAdmin();
  // Keep an existing refresh_token if Google didn't return a fresh one.
  const patch: Record<string, unknown> = {
    provider: "google_calendar",
    access_token: tokens.access_token ?? null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  if (tokens.refresh_token) patch.refresh_token = tokens.refresh_token;
  await db.from("integrations").upsert(patch, { onConflict: "provider" });
}

import { authUrl, googleConfigured } from "@/lib/google";

export const runtime = "nodejs";

// Kick off the Google OAuth consent flow.
export async function GET() {
  if (!googleConfigured()) {
    return new Response("Set GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI to connect Calendar.", { status: 503 });
  }
  return Response.redirect(authUrl());
}

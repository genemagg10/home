import { oauthClient, saveTokens } from "@/lib/google";

export const runtime = "nodejs";

// OAuth redirect target: exchange the code for tokens and store them.
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return new Response("Missing ?code", { status: 400 });

  try {
    const { tokens } = await oauthClient().getToken(code);
    await saveTokens(tokens);
    return Response.redirect(new URL("/?calendar=connected", req.url));
  } catch (e) {
    console.error("Google token exchange failed:", e);
    return new Response("Failed to connect Google Calendar.", { status: 500 });
  }
}

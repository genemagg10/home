// Resolves the app's public base URL across environments, so nothing is
// hardcoded to localhost. Priority:
//   1. NEXT_PUBLIC_SITE_URL  (set this to your custom domain in production)
//   2. VERCEL_URL            (auto-provided by Vercel for every deployment)
//   3. localhost             (local dev fallback)
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// Where Google sends the user back after consent. Defaults to the deployed URL.
export function googleRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || `${siteUrl()}/api/calendar/callback`;
}

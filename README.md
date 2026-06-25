# HomeBase 🏠

Your house as a queryable, living system — a glanceable **status board** plus an
**"Ask the House"** AI chat that answers from everything you've ever fed it
(PDFs, photos, links, notes). Built on the stack you already had success with:
**Next.js on Vercel + Supabase (Postgres + pgvector) + Claude**.

Visual direction: **Style B "Homestead"** (warm, magazine-like). The original
clickable mockups live in [`/mockups`](./mockups).

---

## What's here

| Surface | Where | Notes |
|---|---|---|
| Status board | `app/page.tsx` | Replacements/maintenance (auto "due in N days"), seasonal tasks, active projects, vitals, paint library, live weather strip |
| Ask the House (RAG chat) | `app/api/chat` + `components/AskHouse.tsx` | Streams Claude Opus 4.8, grounded in your docs via pgvector; shows source chips |
| Add anything → review queue | `components/AddButton.tsx`, `app/api/ingest`, `app/review` | AI **suggests** tags + a recurring reminder; nothing publishes until you approve |
| Sitter guide export | `app/sitter` | Filtered, printable subset (no sensitive vitals; sitter-safe contacts only) |
| Weather (live) | `lib/weather.ts` | Open-Meteo, no key. Surfaces freeze/heat → nudges the right seasonal task |
| Google Calendar (one-way push) | `app/api/calendar/*`, `lib/google.ts` | Pushes upcoming due dates out as all-day events |

It runs **before** you connect anything: with no env vars set, the dashboard
renders the sample "Maple Street House" so you can click around immediately.

---

## Hosting (GitHub is the source of truth)

This repo is wired so **the files in GitHub are what Supabase and Vercel run** —
push to `main` and both update. You don't run it from your computer; it lives
online and you reach it from any device.

```
                 ┌──────────► Vercel  (auto-deploys the app on every push)
   GitHub  ──────┤
   (main)        └──────────► Supabase (CI applies supabase/migrations/** on push)
```

### 1. Supabase (database)
1. Create a project at supabase.com. Note your **project ref** (the `xxxx` in
   `xxxx.supabase.co`), database password, and from Settings → API the URL +
   `anon` + `service_role` keys.
2. Add three **GitHub repo secrets** (Settings → Secrets and variables → Actions):
   `SUPABASE_ACCESS_TOKEN` (account token), `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
3. That's it — `.github/workflows/supabase-migrations.yml` applies
   `supabase/migrations/**` to your project on every push to `main` (and you can
   run it on demand from the Actions tab). To load the sample content once, paste
   `supabase/seed.sql` into the Supabase SQL editor.

> Prefer Supabase's own GitHub integration? It does the same thing — point it at
> this repo and the `supabase/` directory. The included workflow is the
> no-dashboard equivalent.

### 2. Vercel (the app)
1. **Import this GitHub repo** at vercel.com → New Project. Framework auto-detects
   as Next.js; no build settings to change.
2. Add the environment variables below in Vercel (Project → Settings → Environment
   Variables). Vercel redeploys on every push, and previews on every branch.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/genemagg10/home)

### 3. Environment variables (set these in Vercel)
| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Live data |
| `ANTHROPIC_API_KEY` | Chat (Opus 4.8) + upload tagging (Haiku 4.5) |
| `OPENAI_API_KEY` | RAG embeddings (`text-embedding-3-small`, 1536-dim) |
| `HOMEBASE_LAT`, `HOMEBASE_LON` | Live weather + freeze/heat nudges |
| `NEXT_PUBLIC_SITE_URL` | Only if you use a custom domain (else auto-detected) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Calendar push (optional) |
| `CRON_SECRET` | Optional: protects the daily calendar-sync cron |

The app **renders sample data with none of these set**, so the first deploy works
immediately; fill them in to go live. The OAuth redirect and all internal links
derive from your deployed URL — there are no hardcoded `localhost` references in
the running app.

### Google Calendar (optional)
Create an OAuth **Web** client in Google Cloud. Set the authorized redirect URI to
`https://YOUR-APP.vercel.app/api/calendar/callback` (must match your deployed URL).
Then visit `/api/calendar/auth` once to connect — `vercel.json` already schedules a
daily push of upcoming due dates.

## Local development (optional)

```bash
npm install
cp .env.example .env.local      # same vars as above
npm run dev                     # http://localhost:3000
```

---

## How the pieces fit

```
Add (note/link/pdf/image)
      │
      ▼
/api/ingest ── Haiku structured pass ──▶ documents(status='pending')   ← review queue
                                              │  approve
                                              ▼
                          chunk → OpenAI embed → doc_chunks(vector)     ← searchable
                                              │
   Ask the House ──▶ /api/chat ── embed question → match_chunks() → Claude (streamed)
```

- **Trust model:** uploads never auto-publish. The review queue (`/review`) is
  where AI suggestions become real data — you approve tags and decide whether a
  suggested chore becomes a tracked reminder.
- **Status, not notifications:** the board computes "due in N days" and
  color-codes it (overdue / soon / ok). No push plumbing.

---

## Notable TODOs (next slices)
- **PDF/image upload**: the `documents.kind` and ingest route already model
  `pdf`/`image`. Wire a Supabase Storage upload in `AddButton`, extract text
  (`pdf-parse` is installed; use Claude vision for image/label OCR), then call
  `/api/ingest` with the extracted `text`.
- **Onboarding wizard**: capture house basics + a bulk "drop all your manuals"
  step. Schema (`houses`, `vitals`, …) is ready; add an `/onboard` flow.
- **Auth + multi-house**: currently single-user (RLS allows anon read; writes via
  service role). Add Supabase Auth + a `house_members` table to scope rows.
- **Calendar dedupe**: events are tagged with `extendedProperties.homebase_item`;
  use it to update instead of re-create on repeated syncs.

See the in-repo session notes for the full product discussion and rationale.

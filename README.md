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

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in as you connect each piece
npm run dev                     # http://localhost:3000  (sample data)
```

### Go live with Supabase
1. Create a Supabase project. In the SQL editor, run `supabase/migrations/0001_init.sql`
   then `0002_integrations.sql`. Optionally run `supabase/seed.sql` for sample content.
2. Put `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

### Enable the AI
- `ANTHROPIC_API_KEY` → chat + upload tagging (Opus 4.8 chat, Haiku 4.5 extraction).
- `OPENAI_API_KEY` → embeddings for RAG (`text-embedding-3-small`, 1536-dim).
  Anthropic has no embeddings endpoint; swap the provider in `lib/embeddings.ts`.

### Weather
- Set `HOMEBASE_LAT` / `HOMEBASE_LON` to your house. That's it.

### Google Calendar (optional)
1. Create an OAuth Web client in Google Cloud; set the three `GOOGLE_*` vars.
2. Visit `/api/calendar/auth` once to connect, then `POST /api/calendar/sync`
   (or wire it to a Vercel Cron) to push upcoming due dates.

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

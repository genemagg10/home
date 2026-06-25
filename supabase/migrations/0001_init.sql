-- HomeBase — initial schema
-- Run in the Supabase SQL editor, or `supabase db push`.
-- Single-house, single-user for now (see README "Multi-house later").

create extension if not exists vector;       -- pgvector for RAG
create extension if not exists pgcrypto;     -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────────────
-- House profile (captured in onboarding; one row for now)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists houses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null default 'My House',
  address       text,
  year_built    int,
  sqft          int,
  beds          int,
  baths         numeric,
  lat           numeric,
  lon           numeric,
  trash_day     text,            -- e.g. "Tuesday"
  recycle_day   text,            -- e.g. "alternate Friday"
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Recurring maintenance / replacements (HVAC filters, batteries, salt, …)
-- "Due in N days" is computed from last_done + interval_days.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists maintenance_items (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  title         text not null,
  detail        text,            -- e.g. "20x25x1 MERV 11 · 2 spares in basement"
  category      text default 'replacement',  -- replacement | service | inspection
  interval_days int,             -- null = one-off
  last_done     date,
  emoji         text default '🔧',
  created_at    timestamptz not null default now()
);

-- Convenience view: computed due date + status bucket
create or replace view maintenance_due as
select
  m.*,
  (m.last_done + (m.interval_days || ' days')::interval)::date as due_date,
  case
    when m.interval_days is null then 'ok'
    when m.last_done is null then 'unknown'
    when (m.last_done + (m.interval_days || ' days')::interval)::date < current_date then 'overdue'
    when (m.last_done + (m.interval_days || ' days')::interval)::date <= current_date + 30 then 'soon'
    else 'ok'
  end as status,
  case when m.interval_days is null or m.last_done is null then null
    else (m.last_done + (m.interval_days || ' days')::interval)::date - current_date
  end as days_remaining
from maintenance_items m;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seasonal tasks (month-aware; surfaced when relevant)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists seasonal_tasks (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  title         text not null,
  detail        text,
  start_month   int not null check (start_month between 1 and 12),
  end_month     int not null check (end_month between 1 and 12),
  emoji         text default '🌿',
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Active / completed projects
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  title         text not null,
  status        text default 'active',   -- active | done | paused
  percent       int default 0 check (percent between 0 and 100),
  next_step     text,
  budget_cents  bigint,
  contractor    text,
  tags          text[] default '{}',
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Home vitals (shutoffs, panel map, filter sizes, wifi, …) — quick reference
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists vitals (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  label         text not null,           -- "Water shutoff"
  value         text not null,           -- "Basement, NW corner…"
  is_sensitive  boolean default false,   -- excluded from sitter export by default
  sort          int default 0,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Trusted contacts
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists contacts (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  name          text not null,
  phone         text,
  role          text,            -- "Plumber", "HVAC", "HOA"
  note          text,
  sitter_safe   boolean default true,    -- included in sitter export
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Paint library (room → color → brand → sheen, with a swatch hex)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists paints (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  room          text not null,
  color_name    text not null,
  brand         text,
  sheen         text,
  hex           text,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Documents: anything you add (pdf/image/link/note). Chunked + embedded for RAG.
-- A document has 1+ chunks. The review queue lives here as status='pending'.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  title         text not null,
  kind          text not null default 'note',  -- pdf | image | link | note
  source_url    text,                           -- link, or Supabase Storage path
  raw_text      text,                           -- extracted/typed text
  -- AI suggestions (the review-queue payload). User confirms before publish.
  ai_summary    text,
  ai_category   text,
  ai_tags       text[] default '{}',
  ai_suggested_task jsonb,        -- {title, interval_days, detail} or null
  status        text not null default 'pending',  -- pending | published | rejected
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);

create table if not exists doc_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid references documents(id) on delete cascade,
  house_id      uuid references houses(id) on delete cascade,
  content       text not null,
  embedding     vector(1536),    -- OpenAI text-embedding-3-small
  created_at    timestamptz not null default now()
);

-- Approximate-NN index for fast similarity search
create index if not exists doc_chunks_embedding_idx
  on doc_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- RAG match function: returns the most similar published chunks.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function match_chunks (
  query_embedding vector(1536),
  match_count int default 6,
  similarity_threshold float default 0.2
)
returns table (
  content     text,
  document_id uuid,
  doc_title   text,
  doc_kind    text,
  similarity  float
)
language sql stable
as $$
  select
    c.content,
    c.document_id,
    d.title as doc_title,
    d.kind  as doc_kind,
    1 - (c.embedding <=> query_embedding) as similarity
  from doc_chunks c
  join documents d on d.id = c.document_id
  where d.status = 'published'
    and 1 - (c.embedding <=> query_embedding) > similarity_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — single-user for now. The service role (server routes) bypasses RLS.
-- When auth lands, scope these to auth.uid() via a house_members table.
-- ─────────────────────────────────────────────────────────────────────────────
alter table houses             enable row level security;
alter table maintenance_items  enable row level security;
alter table seasonal_tasks     enable row level security;
alter table projects           enable row level security;
alter table vitals             enable row level security;
alter table contacts           enable row level security;
alter table paints             enable row level security;
alter table documents          enable row level security;
alter table doc_chunks         enable row level security;

-- For the personal MVP, allow read to the anon key so the dashboard can render
-- client-side; all writes go through server routes using the service role.
do $$
declare t text;
begin
  foreach t in array array[
    'houses','maintenance_items','seasonal_tasks','projects',
    'vitals','contacts','paints','documents','doc_chunks'
  ]
  loop
    execute format(
      'create policy %I on %I for select using (true);',
      t || '_read_anon', t
    );
  end loop;
end $$;

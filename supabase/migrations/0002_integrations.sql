-- Stores OAuth tokens for outbound integrations (Google Calendar one-way push).
-- Single-user MVP: one row per provider. Tokens are secrets — RLS denies all
-- client access; only the service role (server routes) reads/writes.
create table if not exists integrations (
  provider      text primary key,          -- 'google_calendar'
  access_token  text,
  refresh_token text,
  expiry        timestamptz,
  calendar_id   text default 'primary',
  updated_at    timestamptz not null default now()
);

alter table integrations enable row level security;
-- No policies → anon/auth clients get nothing; service role bypasses RLS.

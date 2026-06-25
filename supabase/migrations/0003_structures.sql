-- HomeBase — multi-structure support (e.g. a backyard cottage / ADU)
-- Run in the Supabase SQL editor, or `supabase db push`.
--
-- Model: the property keeps ONE houses row (the "Main House"). Additional
-- buildings live in `structures`. Items can be tagged to a structure;
-- anything untagged belongs to the Main House.

create table if not exists structures (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  name          text not null,
  kind          text default 'building',   -- adu | garage | shed | building …
  sqft          int,
  beds          int,
  baths         numeric,
  notes         text,
  emoji         text default '🏡',
  sort          int default 0,
  created_at    timestamptz not null default now()
);

-- Optional structure tag on the things that physically live somewhere.
-- (Contacts stay property-wide — one plumber serves every building.)
alter table maintenance_items add column if not exists structure_id uuid references structures(id) on delete set null;
alter table seasonal_tasks    add column if not exists structure_id uuid references structures(id) on delete set null;
alter table projects          add column if not exists structure_id uuid references structures(id) on delete set null;
alter table vitals            add column if not exists structure_id uuid references structures(id) on delete set null;
alter table paints            add column if not exists structure_id uuid references structures(id) on delete set null;

-- maintenance_due is `select m.*`, frozen at creation — rebuild it so the new
-- structure_id column flows through to the dashboard.
drop view if exists maintenance_due;
create view maintenance_due as
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

-- RLS: read for the anon dashboard; writes go through the service role.
alter table structures enable row level security;
drop policy if exists structures_read_anon on structures;
create policy structures_read_anon on structures for select using (true);

-- Seed "The Cottage" once (idempotent) so it shows up right after migrating.
insert into structures (house_id, name, kind, sqft, beds, baths, notes, emoji, sort)
select h.id, 'The Cottage', 'adu', 600, 2, 1,
       'Backyard ADU — kitchen, living area, 1 bath w/ shower. Washer & dryer are old (service or replace).',
       '🏡', 1
from houses h
where not exists (select 1 from structures s where s.name = 'The Cottage');

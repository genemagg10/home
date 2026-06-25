-- HomeBase — weekly routines. Lightweight, day-of-week reminders that surface
-- in a ticker when relevant (today/tomorrow) and stay hidden otherwise. Unlike
-- maintenance/projects, these are never "checked off" — they just appear.

create table if not exists routines (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid references houses(id) on delete cascade,
  title         text not null,
  detail        text,
  emoji         text default '🔁',
  days_of_week  int[] not null default '{}',  -- 0=Sun, 1=Mon … 6=Sat
  time_of_day   text,                          -- morning | midday | evening | anytime
  sort          int default 0,
  created_at    timestamptz not null default now()
);

alter table routines enable row level security;
drop policy if exists routines_read_anon on routines;
create policy routines_read_anon on routines for select using (true);

-- Seed the two described routines (idempotent). 4 = Thursday.
insert into routines (house_id, title, detail, emoji, days_of_week, time_of_day, sort)
select h.id, 'Garbage cans to the curb', 'Before Friday morning pickup', '🗑️', '{4}', 'evening', 0
from houses h where not exists (select 1 from routines r where r.title = 'Garbage cans to the curb');

insert into routines (house_id, title, detail, emoji, days_of_week, time_of_day, sort)
select h.id, 'Pick up the yard (dog)', 'Before the gardener arrives', '🐾', '{4}', 'morning', 1
from houses h where not exists (select 1 from routines r where r.title = 'Pick up the yard (dog)');

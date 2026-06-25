-- HomeBase — appliances registry (washer, dryer, fridge, HVAC, water heater…)
-- with make/model/serial, purchase + warranty dates, and a service status.
-- Appliances can be tagged to a structure (e.g. The Cottage).

create table if not exists appliances (
  id             uuid primary key default gen_random_uuid(),
  house_id       uuid references houses(id) on delete cascade,
  structure_id   uuid references structures(id) on delete set null,
  name           text not null,
  brand          text,
  model          text,
  serial         text,
  location       text,
  purchased      date,
  warranty_until date,
  status         text default 'ok',   -- ok | service | replace
  notes          text,
  emoji          text default '🔌',
  created_at     timestamptz not null default now()
);

alter table appliances enable row level security;
drop policy if exists appliances_read_anon on appliances;
create policy appliances_read_anon on appliances for select using (true);

-- A forwarded purchase email can suggest an appliance the user approves in the
-- review queue (parallels ai_suggested_task).
alter table documents add column if not exists ai_suggested_appliance jsonb;

-- Optional: load the sample "Maple Street House" into a fresh database so the
-- live dashboard has content immediately. Run after 0001_init.sql.
-- (The app also falls back to this same data in code when Supabase is unset.)

with h as (
  insert into houses (name, address, year_built, sqft, beds, baths, lat, lon, trash_day, recycle_day)
  values ('The Maple Street House', '1847 Maple St', 1996, 2340, 4, 2.5, 39.7684, -86.1581, 'Tuesday', 'alternate Friday')
  returning id
)
insert into maintenance_items (house_id, title, detail, interval_days, last_done, emoji)
select h.id, x.title, x.detail, x.interval_days, current_date - x.offset_days, x.emoji from h,
(values
  ('HVAC filter — main unit', '20×25×1 MERV 11 · 2 spares in basement', 90, 104, '⚠️'),
  ('Fridge water filter', 'LG LT1000P · order link saved', 180, 189, '💧'),
  ('Detector batteries', '9V ×5 · annual swap', 365, 343, '🔋'),
  ('Water softener salt', '40lb pellets', 60, 34, '🧂'),
  ('Furnace humidifier pad', 'Aprilaire #35', 365, 225, '✓')
) as x(title, detail, interval_days, offset_days, emoji);

insert into seasonal_tasks (house_id, title, detail, start_month, end_month, emoji)
select id, x.title, x.detail, x.sm, x.em, x.emoji from houses,
(values
  ('Service the AC condenser', 'rinse coils, check the refrigerant', 6, 6, '❄️'),
  ('Reverse ceiling fans', 'counter-clockwise for summer · all 4', 6, 6, '🌀'),
  ('Reseal the deck', 'Cabot Honey Teak · ¾ can in shed', 6, 7, '🪵'),
  ('Fertilize the lawn', 'Scotts Step 2', 7, 7, '🌱'),
  ('Gutter cleaning', 'before the leaves fall', 10, 10, '🍂'),
  ('Drain outdoor faucets', 'before the first freeze', 11, 11, '🚰')
) as x(title, detail, sm, em, emoji);

insert into projects (house_id, title, percent, next_step, budget_cents, contractor, tags)
select id, x.title, x.percent, x.next_step, x.budget, x.contractor, x.tags from houses,
(values
  ('Primary bathroom remodel', 62, 'Vanity install Thursday, waiting on the quartz top.', 1420000, 'Reyes Tile & Bath', array['8 receipts']),
  ('Backyard French drain', 30, 'Rent the trencher this weekend.', null, null, array['DIY','permit on file']),
  ('Repaint exterior trim', 90, 'Final coat on the garage door.', null, null, array['SW Tricorn Black'])
) as x(title, percent, next_step, budget, contractor, tags);

insert into vitals (house_id, label, value, is_sensitive, sort)
select id, x.label, x.value, x.sensitive, x.sort from houses,
(values
  ('Water shutoff', 'Basement, NW corner behind the softener', false, 0),
  ('Gas shutoff', 'At the meter, east side', false, 1),
  ('Breaker panel', 'Garage — photo-mapped, 24 circuits', false, 2),
  ('Trash & recycle', 'Trash Tue · Recycle alt-Friday', false, 3),
  ('Furnace filter', '20 × 25 × 1', false, 4),
  ('Wi-Fi', 'MapleNet · password: welcome2maple', true, 5)
) as x(label, value, sensitive, sort);

insert into contacts (house_id, name, phone, role, note, sitter_safe)
select id, x.name, x.phone, x.role, x.note, x.safe from houses,
(values
  ('Reyes Tile & Bath', '(555) 204-8831', 'Tile/Bath', 'current remodel', false),
  ('Hank — Plumber', '(555) 661-2090', 'Plumber', 'knows the house', true),
  ('ComfortAir HVAC', '(555) 880-1145', 'HVAC', 'service contract', true),
  ('Dr. Green Lawn', '(555) 332-0091', 'Lawn', 'quarterly', true)
) as x(name, phone, role, note, safe);

insert into paints (house_id, room, color_name, brand, sheen, hex)
select id, x.room, x.color, x.brand, x.sheen, x.hex from houses,
(values
  ('Exterior trim', 'Tricorn Black', 'SW', 'satin', '#2b2b2e'),
  ('Living room', 'Edgecomb Gray', 'BM', 'eggshell', '#d8d2c4'),
  ('Primary bath', 'Ripe Olive', 'SW', 'matte', '#3f5a52'),
  ('Kitchen & halls', 'White Dove', 'BM', 'eggshell', '#f3efe6')
) as x(room, color, brand, sheen, hex);

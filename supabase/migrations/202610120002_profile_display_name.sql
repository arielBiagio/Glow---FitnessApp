-- Optional greeting name; safe for projects where the column was added manually.
alter table public.profiles add column if not exists display_name text;

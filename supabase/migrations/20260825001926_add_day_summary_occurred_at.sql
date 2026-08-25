alter table public.day_summaries
  add column occurred_at timestamptz;

update public.day_summaries
set occurred_at = created_at
where occurred_at is null;

alter table public.day_summaries
  alter column occurred_at set default now(),
  alter column occurred_at set not null;

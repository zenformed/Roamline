create table public.day_summaries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  summary_date date not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, summary_date, author_id)
);

create index day_summaries_trip_date_idx
  on public.day_summaries (trip_id, summary_date desc);

create index day_summaries_author_id_idx
  on public.day_summaries (author_id);

alter table public.day_summaries enable row level security;

grant select on table public.day_summaries to anon;
grant select, insert, update, delete on table public.day_summaries to authenticated;

create policy "day summaries are visible with their trip"
on public.day_summaries for select
to anon, authenticated
using (private.can_view_trip(trip_id));

create policy "contributors can create their day summary"
on public.day_summaries for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and private.can_contribute(trip_id)
);

create policy "contributors can update their day summary"
on public.day_summaries for update
to authenticated
using (author_id = (select auth.uid()))
with check (
  author_id = (select auth.uid())
  and private.can_contribute(trip_id)
);

create policy "authors can delete their day summary"
on public.day_summaries for delete
to authenticated
using (author_id = (select auth.uid()));

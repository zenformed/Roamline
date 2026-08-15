create extension if not exists pg_trgm;

create index if not exists trips_public_start_date_id_idx
  on public.trips (start_date desc nulls last, id)
  where visibility = 'public';

create index if not exists trips_owner_start_date_id_idx
  on public.trips (owner_id, start_date desc nulls last, id);

create index if not exists trips_name_trgm_idx
  on public.trips using gin (name gin_trgm_ops);

create index if not exists trip_members_user_trip_idx
  on public.trip_members (user_id, trip_id);

create index if not exists media_trip_kind_captured_id_idx
  on public.media (trip_id, kind, captured_at desc nulls last, id);

create index if not exists media_trip_id_idx
  on public.media (trip_id);

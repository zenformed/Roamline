create table public.iphone_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  max_files integer not null default 150 check (max_files between 1 and 500),
  uploaded_files integer not null default 0 check (uploaded_files >= 0),
  completed_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.iphone_upload_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.iphone_upload_sessions(id) on delete cascade,
  media_id uuid not null unique default gen_random_uuid(),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  kind public.media_kind not null,
  captured_at timestamptz,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  status text not null default 'ticketed' check (status in ('ticketed', 'complete', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index iphone_upload_sessions_user_trip_idx on public.iphone_upload_sessions(user_id, trip_id, created_at desc);
create index iphone_upload_sessions_expiry_idx on public.iphone_upload_sessions(expires_at) where completed_at is null;
create index iphone_upload_files_session_idx on public.iphone_upload_files(session_id, created_at);

alter table public.iphone_upload_sessions enable row level security;
alter table public.iphone_upload_files enable row level security;

create policy "Users create their own iPhone upload sessions"
on public.iphone_upload_sessions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.trips t
    where t.id = trip_id
      and (
        t.owner_id = auth.uid()
        or exists (
          select 1 from public.trip_members tm
          where tm.trip_id = t.id and tm.user_id = auth.uid()
        )
      )
  )
);

create policy "Users view their own iPhone upload sessions"
on public.iphone_upload_sessions for select to authenticated
using (user_id = auth.uid());

revoke all on public.iphone_upload_files from anon, authenticated;
grant select, insert on public.iphone_upload_sessions to authenticated;

create table public.checkin_attendees (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);

create index checkin_attendees_user_id_idx
  on public.checkin_attendees (user_id);

alter table public.checkin_attendees enable row level security;

grant select on table public.checkin_attendees to anon;
grant select, insert, delete on table public.checkin_attendees to authenticated;

create policy "checkin attendees are visible with their trip"
on public.checkin_attendees for select
to anon, authenticated
using (
  exists (
    select 1 from public.checkins c
    where c.id = checkin_id
      and private.can_view_trip(c.trip_id)
  )
);

create policy "checkin authors can add trip companions"
on public.checkin_attendees for insert
to authenticated
with check (
  exists (
    select 1 from public.checkins c
    where c.id = checkin_id
      and c.author_id <> user_id
      and (c.author_id = (select auth.uid()) or private.is_trip_owner(c.trip_id))
      and (
        exists (
          select 1 from public.trips t
          where t.id = c.trip_id and t.owner_id = user_id
        )
        or exists (
          select 1 from public.trip_members tm
          where tm.trip_id = c.trip_id
            and tm.user_id = checkin_attendees.user_id
        )
      )
  )
);

create policy "checkin authors can remove companions"
on public.checkin_attendees for delete
to authenticated
using (
  exists (
    select 1 from public.checkins c
    where c.id = checkin_id
      and (c.author_id = (select auth.uid()) or private.is_trip_owner(c.trip_id))
  )
);

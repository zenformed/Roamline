drop policy if exists "Users create their own iPhone upload sessions" on public.iphone_upload_sessions;
drop policy if exists "Users view their own iPhone upload sessions" on public.iphone_upload_sessions;

create policy "Users create their own iPhone upload sessions"
on public.iphone_upload_sessions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.trips t
    where t.id = trip_id
      and (
        t.owner_id = (select auth.uid())
        or exists (
          select 1 from public.trip_members tm
          where tm.trip_id = t.id and tm.user_id = (select auth.uid())
        )
      )
  )
);

create policy "Users view their own iPhone upload sessions"
on public.iphone_upload_sessions for select to authenticated
using (user_id = (select auth.uid()));

create policy "iPhone upload files are service-only"
on public.iphone_upload_files as restrictive for all to authenticated
using (false)
with check (false);

create index iphone_upload_sessions_trip_idx on public.iphone_upload_sessions(trip_id);

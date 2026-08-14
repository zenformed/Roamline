create table if not exists public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists trip_invitations_trip_id_idx on public.trip_invitations(trip_id);
create index if not exists trip_invitations_created_by_idx on public.trip_invitations(created_by);
alter table public.trip_invitations enable row level security;

create policy "trip owners can view invitations"
on public.trip_invitations for select to authenticated
using (exists (select 1 from public.trips where trips.id = trip_id and trips.owner_id = auth.uid()));

create policy "trip owners can create invitations"
on public.trip_invitations for insert to authenticated
with check (created_by = auth.uid() and exists (select 1 from public.trips where trips.id = trip_id and trips.owner_id = auth.uid()));

create policy "trip owners can update invitations"
on public.trip_invitations for update to authenticated
using (exists (select 1 from public.trips where trips.id = trip_id and trips.owner_id = auth.uid()))
with check (exists (select 1 from public.trips where trips.id = trip_id and trips.owner_id = auth.uid()));

create or replace function public.get_trip_invitation(p_token uuid)
returns table (trip_name text, trip_slug text, expires_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select t.name, t.slug::text, i.expires_at
  from public.trip_invitations i
  join public.trips t on t.id = i.trip_id
  where i.token = p_token and i.revoked_at is null and i.expires_at > now()
  limit 1;
$$;

create or replace function public.accept_trip_invitation(p_token uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  invite_record record;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select i.trip_id, t.slug::text as slug into invite_record
  from public.trip_invitations i
  join public.trips t on t.id = i.trip_id
  where i.token = p_token and i.revoked_at is null and i.expires_at > now();
  if invite_record is null then raise exception 'Invitation is invalid or expired'; end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (invite_record.trip_id, current_user_id, 'contributor')
  on conflict (trip_id, user_id) do nothing;
  return invite_record.slug;
end;
$$;

revoke all on function public.get_trip_invitation(uuid) from public;
revoke all on function public.accept_trip_invitation(uuid) from public;
grant execute on function public.get_trip_invitation(uuid) to anon, authenticated;
grant execute on function public.accept_trip_invitation(uuid) to authenticated;

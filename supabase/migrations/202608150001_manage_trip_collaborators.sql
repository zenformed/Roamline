create or replace function public.remove_trip_contributor(target_trip_id uuid, target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.trips
    where id = target_trip_id and owner_id = auth.uid()
  ) then raise exception 'Only the trip owner can remove contributors'; end if;

  delete from public.trip_members
  where trip_id = target_trip_id and user_id = target_user_id;
  return found;
end;
$$;

create or replace function public.revoke_trip_invitation(target_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.trip_invitations invitation
  set revoked_at = now()
  where invitation.id = target_invitation_id
    and invitation.revoked_at is null
    and exists (
      select 1 from public.trips
      where trips.id = invitation.trip_id and trips.owner_id = auth.uid()
    );
  return found;
end;
$$;

revoke all on function public.remove_trip_contributor(uuid, uuid) from public;
revoke all on function public.revoke_trip_invitation(uuid) from public;
grant execute on function public.remove_trip_contributor(uuid, uuid) to authenticated;
grant execute on function public.revoke_trip_invitation(uuid) to authenticated;

drop function if exists public.save_push_subscription(text, text, text, text);

create or replace function public.save_push_subscription(
  subscription_trip_id uuid,
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text,
  subscription_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.trip_follows
    where trip_id = subscription_trip_id and user_id = auth.uid()
  ) then
    raise exception 'Follow this trip before enabling notifications';
  end if;

  insert into public.push_subscriptions(
    user_id, trip_id, endpoint, p256dh, auth,
    notify_checkins, notify_media_batches, user_agent
  )
  values (
    auth.uid(), subscription_trip_id, subscription_endpoint,
    subscription_p256dh, subscription_auth, true, true,
    subscription_user_agent
  )
  on conflict (trip_id, endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    notify_checkins = true,
    notify_media_batches = true,
    user_agent = excluded.user_agent,
    updated_at = now();
end;
$$;

revoke all on function public.save_push_subscription(uuid, text, text, text, text) from public;
grant execute on function public.save_push_subscription(uuid, text, text, text, text) to authenticated;

create or replace function public.trip_push_recipients(target_trip_id uuid)
returns table(endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.trips t
    where t.id = target_trip_id
      and (t.owner_id = auth.uid() or exists (
        select 1 from public.trip_members tm where tm.trip_id = t.id and tm.user_id = auth.uid()
      ))
  ) then
    raise exception 'Not authorized to notify followers';
  end if;

  return query
    select ps.endpoint, ps.p256dh, ps.auth
    from public.trip_follows tf
    join public.push_subscriptions ps
      on ps.user_id = tf.user_id and ps.trip_id = tf.trip_id
    where tf.trip_id = target_trip_id
      and tf.notifications_enabled
      and tf.user_id <> auth.uid();
end;
$$;

revoke all on function public.trip_push_recipients(uuid) from public;
grant execute on function public.trip_push_recipients(uuid) to authenticated;

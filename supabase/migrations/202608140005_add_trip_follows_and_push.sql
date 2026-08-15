create table if not exists public.trip_follows (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  notify_checkins boolean not null default true,
  notify_media_batches boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, endpoint)
);

create index if not exists trip_follows_user_id_idx on public.trip_follows(user_id);
create index if not exists trip_follows_notify_idx on public.trip_follows(trip_id, user_id) where notifications_enabled;
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_trip_user_idx on public.push_subscriptions(trip_id, user_id);

alter table public.trip_follows enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "users can read their follows" on public.trip_follows;
drop policy if exists "users can follow visible trips" on public.trip_follows;
drop policy if exists "users can update their follows" on public.trip_follows;
drop policy if exists "users can delete their follows" on public.trip_follows;
create policy "users can read their follows" on public.trip_follows for select using (auth.uid() = user_id);
create policy "users can follow visible trips" on public.trip_follows for insert with check (
  auth.uid() = user_id and exists (select 1 from public.trips where id = trip_id)
);
create policy "users can update their follows" on public.trip_follows for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users can delete their follows" on public.trip_follows for delete using (auth.uid() = user_id);

drop policy if exists "users can read their push subscriptions" on public.push_subscriptions;
drop policy if exists "users can create their push subscriptions" on public.push_subscriptions;
drop policy if exists "users can update their push subscriptions" on public.push_subscriptions;
drop policy if exists "users can delete their push subscriptions" on public.push_subscriptions;
create policy "users can read their push subscriptions" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "users can create their push subscriptions" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "users can update their push subscriptions" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users can delete their push subscriptions" on public.push_subscriptions for delete using (auth.uid() = user_id);

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
    join public.push_subscriptions ps on ps.user_id = tf.user_id and ps.trip_id = tf.trip_id
    where tf.trip_id = target_trip_id
      and tf.notifications_enabled
      and tf.user_id <> auth.uid();
end;
$$;

revoke all on function public.trip_push_recipients(uuid) from public;
grant execute on function public.trip_push_recipients(uuid) to authenticated;

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

create or replace function public.remove_invalid_push_subscriptions(subscription_endpoints text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare removed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.push_subscriptions where endpoint = any(subscription_endpoints);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.remove_invalid_push_subscriptions(text[]) from public;
grant execute on function public.remove_invalid_push_subscriptions(text[]) to authenticated;

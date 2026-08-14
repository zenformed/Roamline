alter table public.media
add column if not exists checkin_id uuid references public.checkins(id) on delete cascade;

create index if not exists media_checkin_id_idx on public.media(checkin_id);

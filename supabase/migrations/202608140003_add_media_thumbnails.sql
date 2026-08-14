alter table public.media
  add column if not exists thumbnail_storage_path text;

comment on column public.media.thumbnail_storage_path is
  'Durable WebP thumbnail used by timeline and collage views; storage_path remains the display image or playable video.';
